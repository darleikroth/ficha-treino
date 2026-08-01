import { defineStore } from "pinia";
import { computed, ref } from "vue";

import type { Ciclo, TreinoGerado } from "../core/gerador.ts";
import { faseDaSemana, semanaDoCiclo } from "../core/progressao.ts";
import { aoMudar } from "../db/eventos.ts";
import * as repos from "../db/repos.ts";
import { avancarCicloRemoto, CicloDesatualizado } from "../firebase/sync.ts";
import { useConfigStore } from "./config.ts";
import { useMetodologiaStore } from "./metodologia.ts";
import { useSyncStore } from "./sync.ts";

/**
 * Ciclo atual.
 *
 * `ciclo` e `treino` são `computed` sobre o gerador — é aqui que o determinismo
 * paga. Nenhum estado derivado precisa ser invalidado, re-sincronizado ou
 * baixado: o treino de hoje é função pura de (metodologia, número do ciclo).
 */
export const useCicloStore = defineStore("ciclo", () => {
  const sessoesConcluidas = ref(0);
  const avancando = ref(false);
  const erro = ref<string | null>(null);

  const config = useConfigStore();
  const met = useMetodologiaStore();
  const sync = useSyncStore();

  const cicloAtual = computed(() => config.config?.cicloAtual ?? 1);
  const semanasPorCiclo = computed(() => met.metodologia?.semanasPorCiclo ?? 9);

  /** DD-A08: deriva de sessões concluídas, com override manual. */
  const semanaAtual = computed(() => {
    const manual = config.config?.semanaManual;
    if (manual != null) return Math.min(Math.max(1, manual), semanasPorCiclo.value);
    return semanaDoCiclo(sessoesConcluidas.value, semanasPorCiclo.value);
  });

  const faseProgressao = computed(() =>
    met.metodologia ? faseDaSemana(met.metodologia.progressao, semanaAtual.value) : null,
  );

  const ciclo = computed<Ciclo | null>(() => met.gerador?.gerarCiclo(cicloAtual.value) ?? null);

  const volumeSemanal = computed(() => met.gerador?.volumeSemanal() ?? {});

  const avisos = computed(() => {
    // O Ciclo 1 é a ficha real fixada: seus avisos descrevem o ponto de
    // partida, não uma escolha do gerador.
    if (!ciclo.value || ciclo.value.fixado) return [];
    return ciclo.value.avisos;
  });

  const progressoDoCiclo = computed(() => ({
    semana: semanaAtual.value,
    de: semanasPorCiclo.value,
    sessoesConcluidas: sessoesConcluidas.value,
    fracao: Math.min(1, semanaAtual.value / Math.max(1, semanasPorCiclo.value)),
  }));

  function treino(treinoId: string): TreinoGerado | null {
    return ciclo.value?.treinos.find((t) => t.meta.id === treinoId) ?? null;
  }

  let cancelar: (() => void) | null = null;

  async function carregar(uid: string): Promise<void> {
    await recontarSessoes(uid);

    cancelar?.();
    cancelar = aoMudar((colecao) => {
      if (colecao === "sessoes" || colecao === "config") void recontarSessoes(uid);
    });
  }

  async function recontarSessoes(uid: string): Promise<void> {
    sessoesConcluidas.value = await repos.contarSessoesConcluidas(uid, cicloAtual.value);
  }

  /**
   * Avança de ciclo. Exige rede, por design.
   *
   * É a única escrita do app que não passa pelo outbox: a fila resolve por
   * "último a chegar", e um aparelho esquecido offline rebobinaria o ciclo,
   * trocando os exercícios no meio e invalidando as cargas em progresso
   * (ARQUITETURA §5, DD-A03).
   */
  async function avancarCiclo(uid: string): Promise<boolean> {
    if (avancando.value) return false;

    erro.value = null;

    if (!sync.online) {
      erro.value = "Avançar de ciclo precisa de conexão — é o único ponto do app que exige.";
      return false;
    }

    avancando.value = true;
    try {
      const novo = await avancarCicloRemoto(uid, cicloAtual.value);

      // Já está no servidor: aplica localmente sem reenfileirar.
      const atual = await repos.lerConfig(uid);
      if (atual) await repos.aplicarConfigRemota({ ...atual, cicloAtual: novo });

      await config.recarregar(uid);
      await met.recarregarOverrides(uid);
      await recontarSessoes(uid);
      return true;
    } catch (e) {
      erro.value =
        e instanceof CicloDesatualizado
          ? e.message
          : e instanceof Error
            ? e.message
            : "Falha ao avançar de ciclo.";
      return false;
    } finally {
      avancando.value = false;
    }
  }

  /** DD-A06: escolha manual para um slot deste ciclo. */
  async function definirOverride(uid: string, slotId: string, exercicioId: string): Promise<void> {
    await repos.definirOverride(uid, cicloAtual.value, slotId, exercicioId);
    await met.recarregarOverrides(uid);
  }

  async function removerOverride(uid: string, slotId: string): Promise<void> {
    await repos.removerOverride(uid, cicloAtual.value, slotId);
    await met.recarregarOverrides(uid);
  }

  function parar(): void {
    cancelar?.();
    cancelar = null;
  }

  return {
    cicloAtual,
    semanaAtual,
    semanasPorCiclo,
    sessoesConcluidas,
    faseProgressao,
    ciclo,
    volumeSemanal,
    avisos,
    progressoDoCiclo,
    avancando,
    erro,
    treino,
    carregar,
    recontarSessoes,
    avancarCiclo,
    definirOverride,
    removerOverride,
    parar,
  };
});
