/**
 * Esquema do IndexedDB (ARQUITETURA §5).
 *
 * O IndexedDB é o espelho local e a única fonte de leitura da UI (DD-A02). O RTDB
 * escreve aqui através dos listeners; a UI nunca lê de listener direto. Por isso o
 * caminho de leitura é idêntico online e offline.
 */

export const NOME_BD = "fichatreino";
export const VERSAO_BD = 1;

export type NomeStore =
  | "meta"
  | "metodologia"
  | "config"
  | "sessoes"
  | "cargas"
  | "overrides"
  | "outbox";

export type StatusSessao = "ativa" | "concluida" | "descartada";

/** Uma série registrada. Guarda o nome literal do exercício por DD-A05. */
export interface Serie {
  exercicioId: string;
  exercicioNome: string;
  peso: number;
  reps: number;
  rir: number | null;
  concluidaEm: number;
}

export interface Sessao {
  id: string;
  uid: string;
  treinoId: string;
  ciclo: number;
  semana: number;
  metodologiaVersao: string;
  geradorVersao: string;
  status: StatusSessao;
  inicioEm: number;
  fimEm: number | null;
  /** series[slotId][indice] — espelha o aninhamento do RTDB (ARQUITETURA §3). */
  series: Record<string, Record<string, Serie>>;
}

export interface Carga {
  peso: number;
  reps: number;
  bateuTopo: boolean;
  atualizadoEm: number;
  sessaoId?: string;
}

export interface Config {
  uid: string;
  metodologiaVersao: string;
  /** DD-A17: o código do gerador é pinado junto com os dados da metodologia. */
  geradorVersao: string;
  cicloAtual: number;
  semanaManual: number | null;
  incrementoPadrao: number;
  unidade: "kg" | "lb";
  indisponiveis: Record<string, boolean>;
  atualizadoEm: number;
}

export type OperacaoOutbox = "set" | "update" | "remove";
export type EstadoOutbox = "pendente" | "travada";

/**
 * Uma escrita pendente para o RTDB.
 *
 * A chave é autoIncrement de propósito: a drenagem percorre por chave e isso é o
 * que garante ordem de inserção. Paralelizar ou reordenar quebra a causalidade
 * entre "criar sessão" e "adicionar série a ela" (DD-A02).
 */
export interface OpOutbox {
  id?: number;
  path: string;
  op: OperacaoOutbox;
  payload: unknown;
  criadoEm: number;
  tentativas: number;
  estado: EstadoOutbox;
  ultimoErro?: string;
}

/** Acima disso a operação é marcada como travada e exposta no IndicadorSync. */
export const MAX_TENTATIVAS = 8;

/**
 * Marcador substituído por `serverTimestamp()` na drenagem.
 *
 * O LWW de `cargas` precisa do relógio do servidor, não do dispositivo — dois
 * celulares com horários diferentes resolveriam o conflito ao contrário. Como
 * `db/` não importa Firebase, o payload carrega este marcador e
 * `firebase/sync.ts` troca no momento do envio.
 */
export const MARCA_TS_SERVIDOR = "__ts_servidor__";

export function migrar(bd: IDBDatabase, versaoAnterior: number): void {
  if (versaoAnterior < 1) {
    bd.createObjectStore("meta");
    bd.createObjectStore("metodologia", { keyPath: "versao" });
    bd.createObjectStore("config", { keyPath: "uid" });

    const sessoes = bd.createObjectStore("sessoes", { keyPath: "id" });
    sessoes.createIndex("porStatus", "status");
    sessoes.createIndex("porCiclo", "ciclo");
    sessoes.createIndex("porUid", "uid");

    // Chave composta `${uid}:${exercicioId}` e `${uid}:${ciclo}` — mantém os
    // dados de contas diferentes separados no mesmo dispositivo.
    bd.createObjectStore("cargas");
    bd.createObjectStore("overrides");

    const outbox = bd.createObjectStore("outbox", { keyPath: "id", autoIncrement: true });
    outbox.createIndex("porEstado", "estado");
  }
}

export const chaveCarga = (uid: string, exercicioId: string) => `${uid}:${exercicioId}`;
export const chaveOverride = (uid: string, ciclo: number) => `${uid}:${ciclo}`;
