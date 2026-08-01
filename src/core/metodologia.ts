/**
 * Metodologia versionada.
 *
 * Este objeto é a unidade de versionamento do sistema. Ele é:
 *   1. embutido no bundle como fallback offline / primeiro carregamento;
 *   2. semeado em /metodologia/{versao} no RTDB;
 *   3. injetado no gerador (que não importa catálogo estaticamente).
 *
 * Regra: mudanças em pools, famílias, séries ou reps EXIGEM nova versão.
 * Sessões históricas guardam o id e o nome literal do exercício executado,
 * então versões antigas podem ser descartadas sem corromper o histórico —
 * mas um ciclo em andamento nunca deve trocar de versão no meio (DD-A05).
 */

import { EXERCICIOS, type Exercicio } from "./exercicios.ts";
import { SLOTS, TREINOS, CICLO_1_FIXO, PROGRESSAO, type Slot, type TreinoMeta } from "./estrutura.ts";

export interface FaseProgressao {
  semanas: string;
  rir: string;
  nota: string;
}

export interface Metodologia {
  versao: string;
  /** Semanas de treino + 1 de deload. Define o comprimento do ciclo. */
  semanasPorCiclo: number;
  exercicios: Record<string, Exercicio>;
  slots: Slot[];
  treinos: TreinoMeta[];
  /** Ciclo 1 fixado — ficha real, base de cooldown do Ciclo 2 (DD-11). */
  ciclo1: Record<string, string>;
  progressao: FaseProgressao[];
}

export const METODOLOGIA_V1: Metodologia = {
  versao: "v1",
  semanasPorCiclo: 9,
  exercicios: EXERCICIOS,
  slots: SLOTS,
  treinos: TREINOS,
  ciclo1: CICLO_1_FIXO,
  progressao: PROGRESSAO,
};

/** Serializa para seed do RTDB. Slots viram mapa — RTDB não guarda arrays bem. */
export function paraRtdb(m: Metodologia) {
  return {
    versao: m.versao,
    semanasPorCiclo: m.semanasPorCiclo,
    exercicios: m.exercicios,
    slots: Object.fromEntries(m.slots.map((s) => [s.id, s])),
    treinos: Object.fromEntries(m.treinos.map((t) => [t.id, t])),
    ciclo1: m.ciclo1,
    progressao: Object.fromEntries(m.progressao.map((p, i) => [String(i), p])),
  };
}

/** Reconstrói a partir do RTDB, restaurando a ordem determinística dos slots. */
export function deRtdb(raw: any): Metodologia {
  const slots = Object.values(raw.slots ?? {}) as Slot[];
  const treinos = Object.values(raw.treinos ?? {}) as TreinoMeta[];
  const ordemTreino = new Map(treinos.map((t, i) => [t.id, i]));
  // A ordem dos slots é semanticamente relevante: DD-06 depende de T1..T3
  // serem resolvidos antes de T4/T5, e DD-05 depende da ordem intra-treino.
  slots.sort((a, b) => {
    const dt = (ordemTreino.get(a.treino) ?? 0) - (ordemTreino.get(b.treino) ?? 0);
    if (dt !== 0) return dt;
    return a.id.localeCompare(b.id, "en", { numeric: true });
  });
  return {
    versao: raw.versao,
    semanasPorCiclo: raw.semanasPorCiclo ?? 9,
    exercicios: raw.exercicios ?? {},
    slots,
    treinos,
    ciclo1: raw.ciclo1 ?? {},
    progressao: Object.values(raw.progressao ?? {}) as FaseProgressao[],
  };
}
