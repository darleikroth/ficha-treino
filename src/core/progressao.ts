/**
 * Progressão: semana do ciclo e fase de RIR.
 *
 * Módulo novo previsto em ARQUITETURA §9. As funções de sugestão de carga
 * (`sugerirCarga`, `faixaReps`, `bateuTopo`, `e1rm`) entram na Fase 6; por ora
 * ficam aqui só as puras de que a Fase 5 precisa.
 *
 * Como todo o resto de `core/`: sem Vue, sem Pinia, sem Firebase (DD-A01).
 */

import type { FaseProgressao } from "./metodologia.ts";

/** Sessões que compõem uma semana de treino. */
export const SESSOES_POR_SEMANA = 5;

/**
 * Semana atual do ciclo, derivada de sessões concluídas (DD-A08).
 *
 * Derivar de data quebra na primeira semana em que se treina 3 vezes em vez de
 * 5 — e como a fase de RIR depende da semana, isso mandaria treinar em RIR 1
 * quem está na terceira sessão do ciclo.
 */
export function semanaDoCiclo(
  sessoesConcluidas: number,
  semanasPorCiclo: number,
  sessoesPorSemana = SESSOES_POR_SEMANA,
): number {
  const concluidas = Math.max(0, Math.floor(sessoesConcluidas));
  const bruta = Math.floor(concluidas / sessoesPorSemana) + 1;
  return Math.min(bruta, Math.max(1, semanasPorCiclo));
}

/** Interpreta `"1-2"`, `"9"` e `"6-8"` como intervalo fechado de semanas. */
export function intervaloDeSemanas(rotulo: string): [number, number] | null {
  const limpo = rotulo.trim();

  const faixa = /^(\d+)\s*[-–]\s*(\d+)$/.exec(limpo);
  if (faixa) return [Number(faixa[1]), Number(faixa[2])];

  const unica = /^(\d+)$/.exec(limpo);
  if (unica) return [Number(unica[1]), Number(unica[1])];

  return null;
}

/**
 * Fase de progressão que cobre a semana. Devolve `null` em vez de lançar
 * quando nenhuma cobre — um rótulo inesperado não deve derrubar a tela.
 */
export function faseDaSemana(
  progressao: FaseProgressao[],
  semana: number,
): FaseProgressao | null {
  for (const fase of progressao) {
    const intervalo = intervaloDeSemanas(fase.semanas);
    if (!intervalo) continue;
    const [de, ate] = intervalo;
    if (semana >= de && semana <= ate) return fase;
  }
  return null;
}

/** `true` na semana de deload — a última do ciclo. */
export function ehDeload(progressao: FaseProgressao[], semana: number): boolean {
  const fase = faseDaSemana(progressao, semana);
  return fase !== null && /deload/i.test(fase.rir);
}
