import { defineStore } from "pinia";
import { computed, ref, shallowRef } from "vue";

import { bateuTopo, seriesAlvo } from "../core/progressao.ts";
import type { Carga, Serie, Sessao } from "../db/esquema.ts";
import { aoMudar } from "../db/eventos.ts";
import * as repos from "../db/repos.ts";
import { useCicloStore } from "./ciclo.ts";
import { useConfigStore } from "./config.ts";
import { VERSAO_GERADOR } from "../versao.ts";

/** DD-A07: acima disso a sessão ativa é tratada como abandonada. */
export const HORAS_ATE_SESSAO_VELHA = 6;

export interface DadosDaSerie {
  peso: number;
  reps: number;
  rir: number | null;
}

export const useSessaoStore = defineStore("sessao", () => {
  const ativa = shallowRef<Sessao | null>(null);
  const carregando = ref(false);
  const erro = ref<string | null>(null);

  const ciclo = useCicloStore();
  const config = useConfigStore();

  /**
   * DD-A07: sessão ativa parada há horas é treino abandonado, não em curso.
   *
   * Função, não `computed`, de propósito: `Date.now()` não é reativo, então um
   * computed seria calculado uma vez e ficaria cacheado — nunca refletindo a
   * passagem do tempo, que é justamente a única coisa que o faz mudar.
   */
  function pareceAbandonada(): boolean {
    if (!ativa.value) return false;
    const limite = HORAS_ATE_SESSAO_VELHA * 60 * 60 * 1000;
    return Date.now() - ultimaAtividade(ativa.value) > limite;
  }

  const treinoDaSessao = computed(() =>
    ativa.value ? ciclo.treino(ativa.value.treinoId) : null,
  );

  /** Séries de um slot, em ordem de índice. */
  function seriesDoSlot(slotId: string): Serie[] {
    const doSlot = ativa.value?.series[slotId] ?? {};
    return Object.keys(doSlot)
      .map(Number)
      .sort((a, b) => a - b)
      .map((i) => doSlot[String(i)]);
  }

  const progresso = computed(() => {
    const treino = treinoDaSessao.value;
    if (!treino) return { feitas: 0, total: 0 };

    let total = 0;
    let feitas = 0;
    for (const item of treino.itens) {
      total += seriesAlvo(item.slot.series);
      feitas += seriesDoSlot(item.slot.id).length;
    }
    return { feitas, total };
  });

  const completa = computed(() => progresso.value.total > 0 && progresso.value.feitas >= progresso.value.total);

  let cancelar: (() => void) | null = null;

  async function carregar(uid: string): Promise<void> {
    carregando.value = true;
    try {
      ativa.value = (await repos.sessaoAtiva(uid)) ?? null;

      cancelar?.();
      cancelar = aoMudar((colecao) => {
        if (colecao === "sessoes") void recarregar(uid);
      });
    } finally {
      carregando.value = false;
    }
  }

  async function recarregar(uid: string): Promise<void> {
    const atual = ativa.value ? await repos.lerSessao(ativa.value.id) : null;
    ativa.value = atual?.status === "ativa" ? atual : ((await repos.sessaoAtiva(uid)) ?? null);
  }

  /**
   * Inicia uma sessão. Se já houver uma ativa do mesmo treino, retoma — não
   * cria outra: recarregar a página no meio do treino não pode duplicar sessão.
   */
  async function iniciar(uid: string, treinoId: string): Promise<Sessao> {
    erro.value = null;

    const existente = await repos.sessaoAtiva(uid);
    if (existente?.treinoId === treinoId) {
      ativa.value = existente;
      return existente;
    }

    if (existente) {
      // Uma sessão ativa por vez (DD-A07).
      await repos.definirStatusSessao(existente.id, "descartada");
    }

    const nova: Sessao = {
      id: repos.novoIdSessao(),
      uid,
      treinoId,
      ciclo: ciclo.cicloAtual,
      semana: ciclo.semanaAtual,
      metodologiaVersao: config.metodologiaVersao,
      geradorVersao: VERSAO_GERADOR,
      status: "ativa",
      inicioEm: Date.now(),
      fimEm: null,
      series: {},
    };

    await repos.criarSessao(nova);
    ativa.value = nova;
    return nova;
  }

  /**
   * Registra uma série. Commit local imediato: sem spinner, sem esperar rede.
   *
   * Grava também a carga denormalizada (DD-A10) na mesma transação, com
   * `bateuTopo` recalculado sobre as séries alvo do slot (DD-10).
   */
  async function registrarSerie(
    slotId: string,
    indice: number,
    dados: DadosDaSerie,
  ): Promise<void> {
    const sessao = ativa.value;
    if (!sessao) throw new Error("Nenhuma sessão ativa.");

    const item = treinoDaSessao.value?.itens.find((i) => i.slot.id === slotId);
    if (!item) throw new Error(`Slot fora do treino: ${slotId}`);

    const serie: Serie = {
      exercicioId: item.exercicioId,
      exercicioNome: item.exercicio?.nome ?? item.exercicioId,
      peso: dados.peso,
      reps: dados.reps,
      rir: dados.rir,
      concluidaEm: Date.now(),
    };

    // Projeta as séries do slot já com esta, para decidir se bateu o topo.
    const projetadas = [...seriesDoSlot(slotId)];
    projetadas[indice] = serie;

    const alvo = seriesAlvo(item.slot.series);
    const carga: Carga = {
      peso: dados.peso,
      reps: dados.reps,
      bateuTopo: bateuTopo(projetadas.filter(Boolean), item.slot, alvo),
      atualizadoEm: Date.now(),
      sessaoId: sessao.id,
    };

    ativa.value = await repos.registrarSerie(sessao.id, slotId, indice, serie, carga);
  }

  /** Desfazer é o caminho mais usado: erro de digitação é o evento comum. */
  async function desfazerSerie(slotId: string, indice: number): Promise<void> {
    const sessao = ativa.value;
    if (!sessao) return;
    ativa.value = await repos.removerSerie(sessao.id, slotId, indice);
  }

  async function finalizar(uid: string): Promise<void> {
    const sessao = ativa.value;
    if (!sessao) return;

    await repos.definirStatusSessao(sessao.id, "concluida");
    ativa.value = null;
    await ciclo.recontarSessoes(uid);
  }

  async function descartar(uid: string): Promise<void> {
    const sessao = ativa.value;
    if (!sessao) return;

    await repos.definirStatusSessao(sessao.id, "descartada");
    ativa.value = null;
    await ciclo.recontarSessoes(uid);
  }

  function parar(): void {
    cancelar?.();
    cancelar = null;
  }

  return {
    ativa,
    carregando,
    erro,
    pareceAbandonada,
    treinoDaSessao,
    progresso,
    completa,
    seriesDoSlot,
    carregar,
    recarregar,
    iniciar,
    registrarSerie,
    desfazerSerie,
    finalizar,
    descartar,
    parar,
  };
});

/** Momento da última série registrada, ou o início da sessão. */
function ultimaAtividade(sessao: Sessao): number {
  let ultima = sessao.inicioEm;
  for (const doSlot of Object.values(sessao.series)) {
    for (const serie of Object.values(doSlot)) {
      if (serie.concluidaEm > ultima) ultima = serie.concluidaEm;
    }
  }
  return ultima;
}
