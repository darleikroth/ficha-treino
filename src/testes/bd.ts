import { NOME_BD } from "../db/esquema.ts";
import { fecharBd } from "../db/idb.ts";
import { encerrarEventos } from "../db/eventos.ts";

/** Apaga o banco. Entre testes, não entre cenários de persistência. */
export async function zerarBd(): Promise<void> {
  encerrarEventos();
  await fecharBd();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(NOME_BD);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

/**
 * Simula reload da página: derruba a conexão e o estado de módulo, mas preserva
 * o conteúdo em disco. O que sobreviver a isto sobrevive a um F5 de verdade.
 */
export const recarregarPagina = () => fecharBd();
