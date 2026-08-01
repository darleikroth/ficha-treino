/**
 * Sincronização (DD-A02).
 *
 * Duas direções, deliberadamente assimétricas:
 *
 *   subida  — outbox → RTDB, sequencial e em ordem de inserção
 *   descida — listeners RTDB → IndexedDB (nunca direto para a UI)
 *
 * Este é o único módulo que chama `set`/`update`/`remove` do RTDB. A UI nunca
 * escreve no RTDB e nunca lê de listener: escreve no IndexedDB e lê do
 * IndexedDB, e é isso que torna o caminho de leitura idêntico online e offline.
 */

import {
  limitToLast,
  onValue,
  orderByKey,
  query,
  ref as refDo,
  remove as removerNoRtdb,
  serverTimestamp,
  set as gravarNoRtdb,
  update as atualizarNoRtdb,
} from "firebase/database";

import { deRtdb, type Metodologia } from "../core/metodologia.ts";
import * as caminhos from "../db/caminhos.ts";
import { MARCA_TS_SERVIDOR, type Carga, type Config, type OpOutbox, type Sessao } from "../db/esquema.ts";
import * as outbox from "../db/outbox.ts";
import * as repos from "../db/repos.ts";
import { obterBd } from "./app.ts";

/** Quantas sessões o cliente espelha. `sessoes` cresce sem limite (§3). */
export const SESSOES_ESPELHADAS = 30;

/** Troca o marcador pelo `serverTimestamp()` do RTDB, em profundidade. */
export function resolverMarcadores(valor: unknown): unknown {
  if (valor === MARCA_TS_SERVIDOR) return serverTimestamp();
  if (Array.isArray(valor)) return valor.map(resolverMarcadores);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([k, v]) => [k, resolverMarcadores(v)]),
    );
  }
  return valor;
}

export type Aplicador = (op: OpOutbox) => Promise<void>;

/** Executa uma operação do outbox no RTDB. */
export const aplicarNoRtdb: Aplicador = async (op) => {
  const alvo = refDo(obterBd(), op.path);

  switch (op.op) {
    case "set":
      await gravarNoRtdb(alvo, resolverMarcadores(op.payload));
      return;
    case "update":
      await atualizarNoRtdb(alvo, resolverMarcadores(op.payload) as object);
      return;
    case "remove":
      await removerNoRtdb(alvo);
      return;
  }
};

export interface ResultadoDrenagem {
  enviadas: number;
  falhou: boolean;
  travou: boolean;
  /** Quanto esperar antes de tentar de novo, quando `falhou`. */
  esperaMs: number;
  erro?: string;
}

let drenando = false;

/**
 * Drena o outbox.
 *
 * Sequencial e **para na primeira falha**. Continuar depois de um erro
 * aplicaria escritas cuja precondição não chegou ao servidor: a série iria para
 * uma sessão que o RTDB não tem. Fila bloqueada é visível e recuperável;
 * causalidade quebrada não é.
 *
 * O aplicador é injetável para que a ordem e o backoff sejam testáveis sem
 * subir Firebase.
 */
export async function drenar(aplicar: Aplicador = aplicarNoRtdb): Promise<ResultadoDrenagem> {
  // Duas drenagens concorrentes reordenariam a fila — exatamente o que não pode.
  if (drenando) return { enviadas: 0, falhou: false, travou: false, esperaMs: 0 };
  drenando = true;

  let enviadas = 0;
  try {
    for (;;) {
      const [proxima] = await outbox.proximasPendentes(1);
      if (!proxima) break;

      try {
        await aplicar(proxima);
        await outbox.concluir(proxima.id!);
        enviadas++;
      } catch (erro) {
        const depois = await outbox.registrarFalha(proxima.id!, erro);
        return {
          enviadas,
          falhou: true,
          travou: depois?.estado === "travada",
          esperaMs: outbox.esperaDeBackoff(depois?.tentativas ?? 1),
          erro: erro instanceof Error ? erro.message : String(erro),
        };
      }
    }

    if (enviadas > 0) await repos.gravarUltimoSyncEm(Date.now());
    return { enviadas, falhou: false, travou: false, esperaMs: 0 };
  } finally {
    drenando = false;
  }
}

// ------------------------------------------------------- descida

/**
 * Enquanto houver escrita local por subir, o servidor não sobrescreve o local.
 *
 * Sem isto, um snapshot que saiu do servidor antes da nossa escrita chegar
 * apagaria a série recém-registrada — o usuário veria o registro sumir da tela
 * sozinho. Metodologia é exceção: é read-only para o cliente, nunca conflita.
 */
async function localEstaAdiantado(): Promise<boolean> {
  return (await outbox.contarPendentes()) > 0;
}

export interface EscutaAtiva {
  encerrar: () => void;
}

/**
 * Assina os nós do usuário e escreve tudo no IndexedDB.
 *
 * `sessoes` nunca é lido inteiro: cresce sem limite e o cliente só precisa das
 * mais recentes (§3).
 */
export function escutar(uid: string, versaoMetodologia: string): EscutaAtiva {
  const bd = obterBd();
  const cancelamentos: Array<() => void> = [];

  cancelamentos.push(
    onValue(refDo(bd, caminhos.caminhoMetodologia(versaoMetodologia)), (snap) => {
      const bruto = snap.val();
      if (!bruto) return;
      void repos.gravarMetodologia(deRtdb(bruto) as Metodologia);
    }),
  );

  cancelamentos.push(
    onValue(refDo(bd, caminhos.caminhoConfig(uid)), (snap) => {
      const bruto = snap.val() as Omit<Config, "uid"> | null;
      if (!bruto) return;
      void localEstaAdiantado().then((adiantado) => {
        if (!adiantado) void repos.aplicarConfigRemota({ ...bruto, uid });
      });
    }),
  );

  cancelamentos.push(
    onValue(refDo(bd, `${caminhos.caminhoUsuario(uid)}/cargas`), (snap) => {
      const bruto = (snap.val() ?? {}) as Record<string, Carga>;
      void localEstaAdiantado().then((adiantado) => {
        if (adiantado) return;
        for (const [exercicioId, carga] of Object.entries(bruto)) {
          void repos.aplicarCargaRemota(uid, exercicioId, carga);
        }
      });
    }),
  );

  cancelamentos.push(
    onValue(refDo(bd, `${caminhos.caminhoUsuario(uid)}/overrides`), (snap) => {
      const bruto = (snap.val() ?? {}) as Record<string, Record<string, string>>;
      void localEstaAdiantado().then((adiantado) => {
        if (adiantado) return;
        for (const [ciclo, mapa] of Object.entries(bruto)) {
          void repos.aplicarOverridesRemotos(uid, Number(ciclo), mapa);
        }
      });
    }),
  );

  cancelamentos.push(
    onValue(
      query(refDo(bd, caminhos.caminhoSessoes(uid)), orderByKey(), limitToLast(SESSOES_ESPELHADAS)),
      (snap) => {
        const bruto = (snap.val() ?? {}) as Record<string, Omit<Sessao, "id" | "uid">>;
        void localEstaAdiantado().then((adiantado) => {
          if (adiantado) return;
          for (const [id, sessao] of Object.entries(bruto)) {
            void repos.aplicarSessaoRemota({ ...sessao, id, uid, series: sessao.series ?? {} });
          }
        });
      },
    ),
  );

  return {
    encerrar: () => {
      for (const cancelar of cancelamentos) cancelar();
      cancelamentos.length = 0;
    },
  };
}
