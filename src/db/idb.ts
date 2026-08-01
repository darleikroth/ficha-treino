/**
 * Wrapper mínimo sobre IDBDatabase.
 *
 * Sem dependência externa: o core não tem nenhuma e o resto do app só ganha uma
 * quando há motivo. O que falta na API nativa é só promessa e uma transação que
 * aborte quando o callback lança.
 *
 * Sobre `await` dentro de `comTransacao`: uma transação do IndexedDB permanece
 * viva enquanto novas requisições forem emitidas antes do controle voltar ao
 * event loop. `pedido()` resolve num microtask disparado pelo próprio evento de
 * sucesso, então encadear `await pedido(...)` mantém a transação aberta. O que
 * a fecha é aguardar qualquer coisa que não seja uma requisição do IDB — fetch,
 * timer, `Promise.resolve().then` em outra tarefa.
 */

import { migrar, NOME_BD, VERSAO_BD, type NomeStore } from "./esquema.ts";

let conexao: Promise<IDBDatabase> | null = null;

export function suportaIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

export function abrirBd(): Promise<IDBDatabase> {
  if (conexao) return conexao;

  conexao = new Promise<IDBDatabase>((resolve, reject) => {
    if (!suportaIndexedDb()) {
      reject(new Error("IndexedDB indisponível neste ambiente."));
      return;
    }

    const req = indexedDB.open(NOME_BD, VERSAO_BD);

    req.onupgradeneeded = (evento) => migrar(req.result, evento.oldVersion);
    req.onsuccess = () => {
      // Outra aba pediu upgrade: soltar a conexão em vez de bloqueá-la.
      req.result.onversionchange = () => fecharBd();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error ?? new Error("falha ao abrir o IndexedDB"));
    req.onblocked = () =>
      reject(new Error("IndexedDB bloqueado por outra aba com versão anterior aberta."));
  });

  conexao = conexao.catch((erro) => {
    conexao = null;
    throw erro;
  });

  return conexao;
}

/** Fecha a conexão. Usado em troca de versão e para simular reload em teste. */
export async function fecharBd(): Promise<void> {
  if (!conexao) return;
  const pendente = conexao;
  conexao = null;
  await pendente.then((bd) => bd.close()).catch(() => {});
}

/** Promessa de uma requisição do IDB, preservando a janela da transação. */
export function pedido<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("requisição do IndexedDB falhou"));
  });
}

/**
 * Roda `fn` numa transação e resolve quando ela commita — não quando `fn`
 * retorna. Só depois do commit o dado está durável; resolver antes faria o
 * chamador acreditar em escrita que ainda pode abortar.
 */
export async function comTransacao<T>(
  stores: NomeStore[],
  modo: IDBTransactionMode,
  fn: (tx: IDBTransaction) => T | Promise<T>,
): Promise<T> {
  const bd = await abrirBd();

  return new Promise<T>((resolve, reject) => {
    const tx = bd.transaction(stores, modo);
    let resultado: T;
    let falhou = false;

    tx.oncomplete = () => resolve(resultado);
    tx.onerror = () => {
      if (!falhou) reject(tx.error ?? new Error("transação falhou"));
    };
    tx.onabort = () => {
      if (!falhou) reject(tx.error ?? new Error("transação abortada"));
    };

    Promise.resolve()
      .then(() => fn(tx))
      .then((valor) => {
        resultado = valor;
      })
      .catch((erro) => {
        falhou = true;
        try {
          tx.abort();
        } catch {
          // já finalizada
        }
        reject(erro);
      });
  });
}

/**
 * Converte para dado puro antes de persistir.
 *
 * O IndexedDB usa structured clone, que **rejeita Proxy** — e todo objeto que
 * passa por um `ref()` do Vue é um Proxy reativo. Sem isto, gravar um objeto
 * que veio de uma store falha com `DataCloneError` na primeira escrita, no
 * browser, em produção. Deixar a defesa aqui vale mais que confiar em cada
 * chamador lembrar de desembrulhar.
 *
 * Descarta `undefined` de quebra: o RTDB não aceita, e o payload do outbox sai
 * daqui.
 */
export function planificar<T>(valor: T): T {
  if (valor === null || typeof valor !== "object") return valor;
  if (Array.isArray(valor)) return valor.map((item) => planificar(item)) as unknown as T;

  const saida: Record<string, unknown> = {};
  for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) {
    if (item !== undefined) saida[chave] = planificar(item);
  }
  return saida as T;
}

export const ler = <T>(tx: IDBTransaction, store: NomeStore, chave: IDBValidKey) =>
  pedido<T | undefined>(tx.objectStore(store).get(chave) as IDBRequest<T | undefined>);

export const lerTudo = <T>(tx: IDBTransaction, store: NomeStore, consulta?: IDBKeyRange) =>
  pedido<T[]>(tx.objectStore(store).getAll(consulta) as IDBRequest<T[]>);

export const gravar = (
  tx: IDBTransaction,
  store: NomeStore,
  valor: unknown,
  chave?: IDBValidKey,
) => pedido(tx.objectStore(store).put(planificar(valor), chave));

export const remover = (tx: IDBTransaction, store: NomeStore, chave: IDBValidKey) =>
  pedido(tx.objectStore(store).delete(chave));

export const contar = (tx: IDBTransaction, store: NomeStore, consulta?: IDBKeyRange) =>
  pedido<number>(tx.objectStore(store).count(consulta));

export const lerPorIndice = <T>(
  tx: IDBTransaction,
  store: NomeStore,
  indice: string,
  chave: IDBValidKey | IDBKeyRange,
) => pedido<T[]>(tx.objectStore(store).index(indice).getAll(chave) as IDBRequest<T[]>);

/** Apaga todo o conteúdo local. Usado no logout e nos testes. */
export async function limparTudo(): Promise<void> {
  await comTransacao(
    ["meta", "metodologia", "config", "sessoes", "cargas", "overrides", "outbox"],
    "readwrite",
    (tx) => {
      for (const store of tx.objectStoreNames) tx.objectStore(store).clear();
    },
  );
}
