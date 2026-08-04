/**
 * Construtores de caminho do RTDB.
 *
 * Concatenação pura de string, sem SDK. Fica em `db/` e não em `firebase/`
 * porque o outbox grava caminhos absolutos e a regra de dependência é
 * `core ← db ← firebase/sync ← stores ← views` — `db/` não pode importar
 * `firebase/`. (ARQUITETURA §4 lista o módulo como `firebase/paths.ts`; aqui a
 * regra de camadas prevalece, e `firebase/sync.ts` importa daqui.)
 */

export const caminhoMetodologia = (versao: string) => `/metodologia/${versao}`;

export const caminhoUsuario = (uid: string) => `/usuarios/${uid}`;

export const caminhoPerfil = (uid: string) => `${caminhoUsuario(uid)}/perfil`;

export const caminhoConfig = (uid: string) => `${caminhoUsuario(uid)}/config`;

export const caminhoOverridesDoCiclo = (uid: string, ciclo: number) =>
  `${caminhoUsuario(uid)}/overrides/${ciclo}`;

export const caminhoOverride = (uid: string, ciclo: number, slotId: string) =>
  `${caminhoOverridesDoCiclo(uid, ciclo)}/${slotId}`;

export const caminhoSessoes = (uid: string) => `${caminhoUsuario(uid)}/sessoes`;

export const caminhoSessao = (uid: string, sessaoId: string) =>
  `${caminhoSessoes(uid)}/${sessaoId}`;

/**
 * Path exato de uma série. Escrever aqui com `update()` evita
 * read-modify-write — que, com conexão instável, perde dados durante o treino
 * (ARQUITETURA §3).
 */
export const caminhoSerie = (uid: string, sessaoId: string, slotId: string, indice: number) =>
  `${caminhoSessao(uid, sessaoId)}/series/${slotId}/${indice}`;

/** Path exato de uma marcação do modo simples (DD-A18) — mesmo racional acima. */
export const caminhoExercicioFeito = (uid: string, sessaoId: string, slotId: string) =>
  `${caminhoSessao(uid, sessaoId)}/exercicios/${slotId}`;

export const caminhoCarga = (uid: string, exercicioId: string) =>
  `${caminhoUsuario(uid)}/cargas/${exercicioId}`;

export const caminhoPr = (uid: string, exercicioId: string) =>
  `${caminhoUsuario(uid)}/prs/${exercicioId}`;
