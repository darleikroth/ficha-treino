/**
 * Notificação de mudança local.
 *
 * O IndexedDB é compartilhado entre abas e não avisa ninguém quando muda. Sem
 * isso, registrar uma série numa aba deixa a outra exibindo dado velho
 * (ARQUITETURA §5). Também é o gancho que as stores usam para reagir a escrita
 * vinda dos listeners do RTDB, mantendo DD-A02: a UI reage ao IndexedDB, nunca
 * ao listener.
 */

export type Colecao = "meta" | "metodologia" | "config" | "sessoes" | "cargas" | "overrides" | "outbox";

type Ouvinte = (colecao: Colecao) => void;

const ouvintes = new Set<Ouvinte>();
const NOME_CANAL = "fichatreino:mudancas";

let canal: BroadcastChannel | null = null;

function obterCanal(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!canal) {
    canal = new BroadcastChannel(NOME_CANAL);
    canal.onmessage = (evento) => {
      const colecao = evento.data as Colecao;
      for (const ouvinte of ouvintes) ouvinte(colecao);
    };
  }
  return canal;
}

/** Avisa esta aba e as demais que uma coleção mudou. */
export function notificar(...colecoes: Colecao[]): void {
  for (const colecao of colecoes) {
    for (const ouvinte of ouvintes) ouvinte(colecao);
    obterCanal()?.postMessage(colecao);
  }
}

/** Assina mudanças. Devolve a função de cancelamento. */
export function aoMudar(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  obterCanal();
  return () => ouvintes.delete(ouvinte);
}

/** Fecha o canal e solta os ouvintes. Usado em teardown e em teste. */
export function encerrarEventos(): void {
  ouvintes.clear();
  canal?.close();
  canal = null;
}
