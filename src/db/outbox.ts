/**
 * Fila de escrita para o RTDB (DD-A02).
 *
 * Fluxo, sem exceção: `UI → IndexedDB → outbox → RTDB`. A UI faz commit local e
 * não espera rede.
 *
 * Duas propriedades que não podem ser negociadas:
 *
 * 1. **Ordem de inserção.** A chave é autoIncrement e a drenagem percorre por
 *    chave. Paralelizar quebra a causalidade entre "criar sessão" e "adicionar
 *    série a ela" — a série chegaria a um nó inexistente.
 *
 * 2. **Atomicidade com a escrita local.** Enfileirar acontece na MESMA
 *    transação que grava a entidade (ver `repos.ts`). Se fossem transações
 *    separadas, uma queda entre as duas deixaria o dado local sem contrapartida
 *    remota — divergência silenciosa que só aparece em outro dispositivo.
 */

import {
  MAX_TENTATIVAS,
  type OpOutbox,
  type OperacaoOutbox,
} from "./esquema.ts";
import { comTransacao, contar, lerTudo, pedido, planificar, remover } from "./idb.ts";

export interface NovaOp {
  path: string;
  op: OperacaoOutbox;
  payload?: unknown;
}

/** Enfileira dentro de uma transação já aberta. Preferir esta forma. */
export function enfileirar(tx: IDBTransaction, nova: NovaOp): void {
  const op: OpOutbox = {
    path: nova.path,
    op: nova.op,
    payload: nova.op === "remove" ? null : planificar(nova.payload ?? null),
    criadoEm: Date.now(),
    tentativas: 0,
    estado: "pendente",
  };
  tx.objectStore("outbox").add(op);
}

/** Enfileira em transação própria. Para operações sem escrita local associada. */
export async function enfileirarAgora(nova: NovaOp): Promise<void> {
  await comTransacao(["outbox"], "readwrite", (tx) => enfileirar(tx, nova));
}

/**
 * Operações a drenar, em ordem, **até a primeira travada**.
 *
 * Parar na travada é deliberado: pular para continuar drenando aplicaria
 * escritas que dependem da que falhou. Uma operação travada bloqueia a fila e
 * aparece no `IndicadorSync` — falha permanente costuma ser regra de segurança,
 * e retry infinito só esconde o bug.
 */
export async function proximasPendentes(limite = Infinity): Promise<OpOutbox[]> {
  return comTransacao(["outbox"], "readonly", async (tx) => {
    const todas = await lerTudo<OpOutbox>(tx, "outbox");
    todas.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

    const pendentes: OpOutbox[] = [];
    for (const op of todas) {
      if (op.estado === "travada") break;
      pendentes.push(op);
      if (pendentes.length >= limite) break;
    }
    return pendentes;
  });
}

export async function todas(): Promise<OpOutbox[]> {
  return comTransacao(["outbox"], "readonly", async (tx) => {
    const lista = await lerTudo<OpOutbox>(tx, "outbox");
    return lista.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  });
}

export async function travadas(): Promise<OpOutbox[]> {
  return (await todas()).filter((op) => op.estado === "travada");
}

export async function contarPendentes(): Promise<number> {
  return comTransacao(["outbox"], "readonly", (tx) => contar(tx, "outbox"));
}

/** Remove após sucesso no RTDB. */
export async function concluir(id: number): Promise<void> {
  await comTransacao(["outbox"], "readwrite", (tx) => remover(tx, "outbox", id));
}

/**
 * Contabiliza uma falha. Acima de `MAX_TENTATIVAS` a operação trava.
 * Devolve a operação atualizada para que o chamador calcule o backoff.
 */
export async function registrarFalha(id: number, erro: unknown): Promise<OpOutbox | undefined> {
  return comTransacao(["outbox"], "readwrite", async (tx) => {
    const store = tx.objectStore("outbox");
    const op = await pedido<OpOutbox | undefined>(store.get(id) as IDBRequest<OpOutbox | undefined>);
    if (!op) return undefined;

    op.tentativas += 1;
    op.ultimoErro = erro instanceof Error ? erro.message : String(erro);
    if (op.tentativas >= MAX_TENTATIVAS) op.estado = "travada";

    await pedido(store.put(op));
    return op;
  });
}

/** Backoff exponencial de 1s a 60s (ARQUITETURA §5). */
export function esperaDeBackoff(tentativas: number): number {
  return Math.min(1000 * 2 ** Math.max(0, tentativas - 1), 60_000);
}

/** Destrava tudo para nova tentativa — ação manual, a partir do IndicadorSync. */
export async function destravar(): Promise<number> {
  return comTransacao(["outbox"], "readwrite", async (tx) => {
    const store = tx.objectStore("outbox");
    const lista = await pedido<OpOutbox[]>(store.getAll() as IDBRequest<OpOutbox[]>);
    const presas = lista.filter((op) => op.estado === "travada");

    for (const op of presas) {
      op.estado = "pendente";
      op.tentativas = 0;
      delete op.ultimoErro;
      store.put(op);
    }
    return presas.length;
  });
}

export async function descartar(id: number): Promise<void> {
  await concluir(id);
}
