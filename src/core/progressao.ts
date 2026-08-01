/**
 * Progressão: semana do ciclo, fase de RIR e sugestão de carga.
 *
 * Módulo previsto em ARQUITETURA §9 — o único do core escrito aqui, não vindo
 * do pacote de referência. Como todo o resto de `core/`: sem Vue, sem Pinia,
 * sem Firebase (DD-A01).
 *
 * Tudo que interpreta `slot.series` e `slot.reps` parseia defensivamente e
 * devolve `null` em vez de lançar. Na v1 os formatos são regulares, mas
 * `reps` já traz `"6-10 / falha"`, e um rótulo textual numa versão futura não
 * pode derrubar a tela de treino no meio da série.
 */

import type { Slot } from "./estrutura.ts";
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

// ------------------------------------------------- sugestão de carga

export interface Carga {
  peso: number;
  reps: number;
  bateuTopo: boolean;
  atualizadoEm: number;
}

export interface Sugestao {
  peso: number;
  motivo: string;
  fonte: "ultima" | "progressao" | "sem-historico";
}

/** Primeiro par de números do rótulo: `"6-10 / falha"` → `[6, 10]`. */
function primeiroIntervalo(rotulo: string): [number, number] | null {
  const faixa = /(\d+)\s*[-–a]\s*(\d+)/.exec(rotulo);
  if (faixa) {
    const de = Number(faixa[1]);
    const ate = Number(faixa[2]);
    return de <= ate ? [de, ate] : [ate, de];
  }

  const unico = /(\d+)/.exec(rotulo);
  if (unico) return [Number(unico[1]), Number(unico[1])];

  return null;
}

/**
 * Faixa de repetições do slot. `null` quando o rótulo não tem número — e
 * `null` significa "sem progressão automática", não erro.
 */
export function faixaReps(reps: string): [number, number] | null {
  return primeiroIntervalo(reps ?? "");
}

/** Quantas séries o slot pede. `"3-4"` devolve `[3, 4]`. */
export function faixaSeries(series: string): [number, number] | null {
  return primeiroIntervalo(series ?? "");
}

/** Número de campos de série a exibir — o topo da faixa, quando houver. */
export function seriesAlvo(series: string, padrao = 3): number {
  const faixa = faixaSeries(series);
  return faixa ? faixa[1] : padrao;
}

/**
 * DD-10: `true` quando todas as séries alvo foram feitas **e** todas chegaram
 * ao topo da faixa. Sem faixa numérica não há progressão automática.
 */
export function bateuTopo(
  series: { reps: number }[],
  slot: Pick<Slot, "reps">,
  alvo: number,
): boolean {
  const faixa = faixaReps(slot.reps);
  if (!faixa) return false;
  if (alvo <= 0 || series.length < alvo) return false;

  const [, topo] = faixa;
  return series.slice(0, alvo).every((s) => Number.isFinite(s.reps) && s.reps >= topo);
}

/**
 * Sugestão de carga a partir da última execução (DD-A09).
 *
 * É sempre editável e nunca é persistida como se fosse registro — quem grava é
 * o usuário ao confirmar a série.
 */
export function sugerirCarga(
  slot: Pick<Slot, "reps">,
  ultima: Carga | undefined,
  incremento: number,
): Sugestao {
  if (!ultima || !Number.isFinite(ultima.peso)) {
    return { peso: 0, motivo: "Primeira vez neste exercício", fonte: "sem-historico" };
  }

  const faixa = faixaReps(slot.reps);

  if (!faixa) {
    return {
      peso: ultima.peso,
      motivo: "Mesma carga da última — este slot não tem faixa numérica",
      fonte: "ultima",
    };
  }

  if (ultima.bateuTopo && incremento > 0) {
    return {
      peso: arredondar(ultima.peso + incremento),
      motivo: `+${formatar(incremento)} da última (bateu o topo da faixa)`,
      fonte: "progressao",
    };
  }

  return {
    peso: ultima.peso,
    motivo: `Mesma carga da última (${ultima.reps} reps, alvo ${faixa[0]}-${faixa[1]})`,
    fonte: "ultima",
  };
}

/**
 * Epley. Só para exibir PR — nunca para prescrever carga: a fórmula erra feio
 * acima de ~10 repetições.
 */
export function e1rm(peso: number, reps: number): number {
  if (!Number.isFinite(peso) || !Number.isFinite(reps) || peso <= 0 || reps <= 0) return 0;
  if (reps === 1) return arredondar(peso);
  return arredondar(peso * (1 + reps / 30));
}

/** Duas casas, sem lixo de ponto flutuante em somas de 2,5 em 2,5. */
function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function formatar(valor: number): string {
  return String(arredondar(valor)).replace(".", ",");
}
