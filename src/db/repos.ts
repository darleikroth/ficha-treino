/**
 * Repositórios por entidade.
 *
 * Toda mutação vinda da UI grava a entidade **e** enfileira a operação do RTDB
 * na mesma transação (DD-A02). As funções `aplicar*Remoto` são o caminho
 * oposto — escrita vinda dos listeners do RTDB — e por isso **não** enfileiram
 * nada: repropagar o que acabou de chegar do servidor criaria um laço.
 */

import type { Metodologia } from "../core/metodologia.ts";
import {
  chaveCarga,
  chaveOverride,
  MARCA_TS_SERVIDOR,
  type Carga,
  type Config,
  type Serie,
  type Sessao,
  type StatusSessao,
} from "./esquema.ts";
import * as caminhos from "./caminhos.ts";
import { notificar } from "./eventos.ts";
import { comTransacao, ler, lerPorIndice, lerTudo, gravar, pedido, remover } from "./idb.ts";
import { enfileirar } from "./outbox.ts";

// ---------------------------------------------------------------- meta

export const lerMeta = <T>(chave: string) =>
  comTransacao(["meta"], "readonly", (tx) => ler<T>(tx, "meta", chave));

export async function gravarMeta(chave: string, valor: unknown): Promise<void> {
  await comTransacao(["meta"], "readwrite", (tx) => gravar(tx, "meta", valor, chave));
  notificar("meta");
}

export const lerUidAtivo = () => lerMeta<string>("uidAtivo");
export const gravarUidAtivo = (uid: string) => gravarMeta("uidAtivo", uid);
export const lerUltimoSyncEm = () => lerMeta<number>("ultimoSyncEm");
export const gravarUltimoSyncEm = (quando: number) => gravarMeta("ultimoSyncEm", quando);

// -------------------------------------------------------- metodologia

export const lerMetodologia = (versao: string) =>
  comTransacao(["metodologia"], "readonly", (tx) => ler<Metodologia>(tx, "metodologia", versao));

/** Só chega do RTDB ou do bundle de fallback: nunca vai para o outbox. */
export async function gravarMetodologia(metodologia: Metodologia): Promise<void> {
  await comTransacao(["metodologia"], "readwrite", (tx) => gravar(tx, "metodologia", metodologia));
  notificar("metodologia");
}

// -------------------------------------------------------------- config

export const lerConfig = (uid: string) =>
  comTransacao(["config"], "readonly", (tx) => ler<Config>(tx, "config", uid));

export async function gravarConfig(config: Config): Promise<void> {
  const comCarimbo: Config = { ...config, atualizadoEm: Date.now() };

  await comTransacao(["config", "outbox"], "readwrite", (tx) => {
    gravar(tx, "config", comCarimbo);
    enfileirar(tx, {
      path: caminhos.caminhoConfig(config.uid),
      op: "update",
      payload: { ...semUid(comCarimbo), atualizadoEm: MARCA_TS_SERVIDOR },
    });
  });

  notificar("config");
}

export async function aplicarConfigRemota(config: Config): Promise<void> {
  await comTransacao(["config"], "readwrite", (tx) => gravar(tx, "config", config));
  notificar("config");
}

const semUid = ({ uid: _uid, ...resto }: Config) => resto;

// ----------------------------------------------------------- overrides

export const lerOverrides = (uid: string, ciclo: number) =>
  comTransacao(["overrides"], "readonly", (tx) =>
    ler<Record<string, string>>(tx, "overrides", chaveOverride(uid, ciclo)),
  );

/** DD-A06: escolha manual de exercício para um slot num ciclo específico. */
export async function definirOverride(
  uid: string,
  ciclo: number,
  slotId: string,
  exercicioId: string,
): Promise<void> {
  await comTransacao(["overrides", "outbox"], "readwrite", async (tx) => {
    const chave = chaveOverride(uid, ciclo);
    const atual = (await ler<Record<string, string>>(tx, "overrides", chave)) ?? {};

    await gravar(tx, "overrides", { ...atual, [slotId]: exercicioId }, chave);
    enfileirar(tx, {
      path: caminhos.caminhoOverride(uid, ciclo, slotId),
      op: "set",
      payload: exercicioId,
    });
  });

  notificar("overrides");
}

export async function removerOverride(uid: string, ciclo: number, slotId: string): Promise<void> {
  await comTransacao(["overrides", "outbox"], "readwrite", async (tx) => {
    const chave = chaveOverride(uid, ciclo);
    const atual = (await ler<Record<string, string>>(tx, "overrides", chave)) ?? {};
    delete atual[slotId];

    await gravar(tx, "overrides", atual, chave);
    enfileirar(tx, { path: caminhos.caminhoOverride(uid, ciclo, slotId), op: "remove" });
  });

  notificar("overrides");
}

/**
 * Todos os overrides do usuário, na forma que `criarGerador` espera em
 * `ciclosFixos`. O override participa da cadeia de cooldown, então o gerador
 * precisa de todos os ciclos, não só do atual (DD-A06).
 */
export async function lerTodosOverrides(
  uid: string,
): Promise<Record<number, Record<string, string>>> {
  return comTransacao(["overrides"], "readonly", async (tx) => {
    const store = tx.objectStore("overrides");
    const chaves = pedido<IDBValidKey[]>(store.getAllKeys());
    const valores = pedido<Record<string, string>[]>(
      store.getAll() as IDBRequest<Record<string, string>[]>,
    );

    const [ks, vs] = await Promise.all([chaves, valores]);
    const prefixo = `${uid}:`;
    const porCiclo: Record<number, Record<string, string>> = {};

    ks.forEach((chave, i) => {
      const texto = String(chave);
      if (!texto.startsWith(prefixo)) return;
      const ciclo = Number(texto.slice(prefixo.length));
      if (!Number.isFinite(ciclo)) return;
      if (vs[i] && Object.keys(vs[i]).length > 0) porCiclo[ciclo] = vs[i];
    });

    return porCiclo;
  });
}

export async function aplicarOverridesRemotos(
  uid: string,
  ciclo: number,
  mapa: Record<string, string>,
): Promise<void> {
  await comTransacao(["overrides"], "readwrite", (tx) =>
    gravar(tx, "overrides", mapa, chaveOverride(uid, ciclo)),
  );
  notificar("overrides");
}

// ------------------------------------------------------------- sessões

export const lerSessao = (sessaoId: string) =>
  comTransacao(["sessoes"], "readonly", (tx) => ler<Sessao>(tx, "sessoes", sessaoId));

/** DD-A07: uma sessão ativa por vez. */
export async function sessaoAtiva(uid: string): Promise<Sessao | undefined> {
  const ativas = await comTransacao(["sessoes"], "readonly", (tx) =>
    lerPorIndice<Sessao>(tx, "sessoes", "porStatus", "ativa"),
  );
  return ativas
    .filter((s) => s.uid === uid)
    .sort((a, b) => b.inicioEm - a.inicioEm)[0];
}

/** `sessaoId` começa com timestamp, então ordem de chave é ordem cronológica. */
export async function sessoesRecentes(uid: string, limite = 30): Promise<Sessao[]> {
  const todas = await comTransacao(["sessoes"], "readonly", (tx) => lerTudo<Sessao>(tx, "sessoes"));
  return todas
    .filter((s) => s.uid === uid)
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, limite);
}

/** Base de DD-A08: a semana do ciclo deriva daqui, não de data. */
export async function contarSessoesConcluidas(uid: string, ciclo: number): Promise<number> {
  const doCiclo = await comTransacao(["sessoes"], "readonly", (tx) =>
    lerPorIndice<Sessao>(tx, "sessoes", "porCiclo", ciclo),
  );
  return doCiclo.filter((s) => s.uid === uid && s.status === "concluida").length;
}

/** DD-A07: id gerado no cliente, ordenável e sem colisão entre dispositivos. */
export function novoIdSessao(agora = Date.now()): string {
  const aleatorio = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, "0");
  return `${agora}-${aleatorio}`;
}

export async function criarSessao(sessao: Sessao): Promise<void> {
  await comTransacao(["sessoes", "outbox"], "readwrite", (tx) => {
    gravar(tx, "sessoes", sessao);
    enfileirar(tx, {
      path: caminhos.caminhoSessao(sessao.uid, sessao.id),
      op: "set",
      payload: paraRtdbSessao(sessao),
    });
  });

  notificar("sessoes");
}

/**
 * Registra uma série.
 *
 * Escrita dupla, num commit só: a série na sessão e a carga denormalizada
 * (DD-A10). Abrir um treino precisa da última carga de ~8 exercícios
 * instantaneamente e offline; varrer sessões para derivar isso exigiria ter o
 * histórico completo local.
 */
export async function registrarSerie(
  sessaoId: string,
  slotId: string,
  indice: number,
  serie: Serie,
  carga: Carga,
): Promise<Sessao> {
  const sessao = await comTransacao(["sessoes", "cargas", "outbox"], "readwrite", async (tx) => {
    const atual = await ler<Sessao>(tx, "sessoes", sessaoId);
    if (!atual) throw new Error(`Sessão inexistente: ${sessaoId}`);

    const series = { ...atual.series, [slotId]: { ...atual.series[slotId], [indice]: serie } };
    const atualizada: Sessao = { ...atual, series };
    const { uid } = atual;

    await gravar(tx, "sessoes", atualizada);
    await gravar(tx, "cargas", carga, chaveCarga(uid, serie.exercicioId));

    enfileirar(tx, {
      path: caminhos.caminhoSerie(uid, sessaoId, slotId, indice),
      op: "set",
      payload: serie,
    });
    enfileirar(tx, {
      path: caminhos.caminhoCarga(uid, serie.exercicioId),
      op: "set",
      payload: { ...carga, atualizadoEm: MARCA_TS_SERVIDOR },
    });

    return atualizada;
  });

  notificar("sessoes", "cargas");
  return sessao;
}

/** Desfazer é o caminho mais usado da tela: erro de digitação é o evento comum. */
export async function removerSerie(
  sessaoId: string,
  slotId: string,
  indice: number,
): Promise<Sessao> {
  const sessao = await comTransacao(["sessoes", "outbox"], "readwrite", async (tx) => {
    const atual = await ler<Sessao>(tx, "sessoes", sessaoId);
    if (!atual) throw new Error(`Sessão inexistente: ${sessaoId}`);

    const doSlot = { ...atual.series[slotId] };
    delete doSlot[String(indice)];

    const series = { ...atual.series, [slotId]: doSlot };
    const atualizada: Sessao = { ...atual, series };

    await gravar(tx, "sessoes", atualizada);
    enfileirar(tx, {
      path: caminhos.caminhoSerie(atual.uid, sessaoId, slotId, indice),
      op: "remove",
    });

    return atualizada;
  });

  notificar("sessoes");
  return sessao;
}

export async function definirStatusSessao(
  sessaoId: string,
  status: StatusSessao,
  fimEm: number | null = status === "ativa" ? null : Date.now(),
): Promise<Sessao> {
  const sessao = await comTransacao(["sessoes", "outbox"], "readwrite", async (tx) => {
    const atual = await ler<Sessao>(tx, "sessoes", sessaoId);
    if (!atual) throw new Error(`Sessão inexistente: ${sessaoId}`);

    const atualizada: Sessao = { ...atual, status, fimEm };
    await gravar(tx, "sessoes", atualizada);

    enfileirar(tx, {
      path: caminhos.caminhoSessao(atual.uid, sessaoId),
      op: "update",
      payload: { status, fimEm },
    });

    return atualizada;
  });

  notificar("sessoes");
  return sessao;
}

export async function aplicarSessaoRemota(sessao: Sessao): Promise<void> {
  await comTransacao(["sessoes"], "readwrite", (tx) => gravar(tx, "sessoes", sessao));
  notificar("sessoes");
}

export async function removerSessaoLocal(sessaoId: string): Promise<void> {
  await comTransacao(["sessoes"], "readwrite", (tx) => remover(tx, "sessoes", sessaoId));
  notificar("sessoes");
}

/** Serializa a sessão para o RTDB: sem `id` e sem `uid`, já implícitos no path. */
function paraRtdbSessao(sessao: Sessao) {
  const { id: _id, uid: _uid, ...resto } = sessao;
  return resto;
}

// -------------------------------------------------------------- cargas

export const lerCarga = (uid: string, exercicioId: string) =>
  comTransacao(["cargas"], "readonly", (tx) =>
    ler<Carga>(tx, "cargas", chaveCarga(uid, exercicioId)),
  );

/** Mapa `exercicioId → Carga` do usuário. É o que a tela de treino consulta. */
export async function lerCargas(uid: string): Promise<Record<string, Carga>> {
  return comTransacao(["cargas"], "readonly", async (tx) => {
    const store = tx.objectStore("cargas");
    // Emitidas antes de qualquer await: as duas requisições vivem na mesma
    // transação e o Promise.all só espera microtasks do próprio IDB.
    const chaves = pedido<IDBValidKey[]>(store.getAllKeys());
    const valores = pedido<Carga[]>(store.getAll() as IDBRequest<Carga[]>);

    const [ks, vs] = await Promise.all([chaves, valores]);
    const prefixo = `${uid}:`;
    const mapa: Record<string, Carga> = {};

    ks.forEach((chave, i) => {
      const texto = String(chave);
      if (texto.startsWith(prefixo)) mapa[texto.slice(prefixo.length)] = vs[i];
    });

    return mapa;
  });
}

export async function aplicarCargaRemota(
  uid: string,
  exercicioId: string,
  carga: Carga,
): Promise<void> {
  await comTransacao(["cargas"], "readwrite", (tx) =>
    gravar(tx, "cargas", carga, chaveCarga(uid, exercicioId)),
  );
  notificar("cargas");
}
