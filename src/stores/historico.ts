import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { e1rm } from "../core/progressao.ts";
import type { Sessao } from "../db/esquema.ts";
import { aoMudar } from "../db/eventos.ts";
import * as repos from "../db/repos.ts";

export interface PontoDeProgressao {
  data: number;
  peso: number;
  reps: number;
  e1rm: number;
  sessaoId: string;
}

export interface ResumoDeExercicio {
  exercicioId: string;
  /** Nome literal gravado na série (DD-A05) — legível mesmo fora do catálogo. */
  nome: string;
  pontos: PontoDeProgressao[];
  melhorE1rm: number;
  ultimoPeso: number;
}

/**
 * Histórico de sessões e progressão por exercício.
 *
 * Deriva tudo das sessões espelhadas localmente. Como as séries guardam o nome
 * literal do exercício (DD-A05), o histórico continua legível mesmo se o id
 * sair do catálogo numa versão futura da metodologia.
 */
export const useHistoricoStore = defineStore("historico", () => {
  const sessoes = ref<Sessao[]>([]);
  const carregando = ref(false);

  const concluidas = computed(() =>
    sessoes.value.filter((s) => s.status === "concluida").sort((a, b) => b.id.localeCompare(a.id)),
  );

  const totalDeSeries = (sessao: Sessao) =>
    Object.values(sessao.series).reduce((soma, slot) => soma + Object.keys(slot).length, 0);

  /** Marcações do modo simples (DD-A18) — sessões antigas não têm o nó. */
  const totalDeExercicios = (sessao: Sessao) => Object.keys(sessao.exercicios ?? {}).length;

  const volumeDaSessao = (sessao: Sessao) =>
    Object.values(sessao.series).reduce(
      (soma, slot) =>
        soma + Object.values(slot).reduce((s, serie) => s + serie.peso * serie.reps, 0),
      0,
    );

  /** Uma linha por exercício executado, com a progressão em ordem cronológica. */
  const porExercicio = computed<ResumoDeExercicio[]>(() => {
    const mapa = new Map<string, ResumoDeExercicio>();

    for (const sessao of [...concluidas.value].reverse()) {
      for (const slot of Object.values(sessao.series)) {
        for (const serie of Object.values(slot)) {
          const atual = mapa.get(serie.exercicioId) ?? {
            exercicioId: serie.exercicioId,
            nome: serie.exercicioNome,
            pontos: [],
            melhorE1rm: 0,
            ultimoPeso: 0,
          };

          const estimado = e1rm(serie.peso, serie.reps);
          atual.nome = serie.exercicioNome || atual.nome;
          atual.pontos.push({
            data: serie.concluidaEm,
            peso: serie.peso,
            reps: serie.reps,
            e1rm: estimado,
            sessaoId: sessao.id,
          });
          atual.melhorE1rm = Math.max(atual.melhorE1rm, estimado);
          atual.ultimoPeso = serie.peso;

          mapa.set(serie.exercicioId, atual);
        }
      }
    }

    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  });

  let cancelar: (() => void) | null = null;

  async function carregar(uid: string): Promise<void> {
    carregando.value = true;
    try {
      sessoes.value = await repos.sessoesRecentes(uid, 200);

      cancelar?.();
      cancelar = aoMudar((colecao) => {
        if (colecao === "sessoes") void recarregar(uid);
      });
    } finally {
      carregando.value = false;
    }
  }

  async function recarregar(uid: string): Promise<void> {
    sessoes.value = await repos.sessoesRecentes(uid, 200);
  }

  function parar(): void {
    cancelar?.();
    cancelar = null;
  }

  return {
    sessoes,
    concluidas,
    porExercicio,
    carregando,
    totalDeSeries,
    totalDeExercicios,
    volumeDaSessao,
    carregar,
    recarregar,
    parar,
  };
});
