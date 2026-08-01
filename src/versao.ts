/**
 * Versão do CÓDIGO do gerador (DD-A17).
 *
 * `metodologiaVersao` versiona os *dados* — pools, slots, séries, reps. Não
 * cobre mudanças no gerador, e a distinção deixou de ser teórica: o off-by-one
 * no cooldown de DD-04 alterou a saída de todos os ciclos ≥ 3 sem que a
 * metodologia mudasse uma linha.
 *
 * Bumpe aqui sempre que uma alteração em `src/core/gerador.ts` mudar a saída de
 * `gerarCiclo`. Trocar de versão com ciclo em andamento é bloqueado, igual
 * DD-A03: aplicar no meio trocaria os exercícios de alguém na semana 4.
 *
 * Histórico:
 *   g1 — cooldown de DD-04 comparando com o ciclo N−1 (2026-08-01)
 */
export const VERSAO_GERADOR = "g1";

/** Versão da metodologia embutida no bundle como fallback offline. */
export const VERSAO_METODOLOGIA_PADRAO = "v1";
