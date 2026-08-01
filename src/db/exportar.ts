/**
 * Export de dados (ARQUITETURA §7, tela de Config).
 *
 * Lê tudo do IndexedDB — que é o espelho completo do que interessa — em vez de
 * consultar o RTDB: funciona offline e não depende de rede para o usuário
 * levar os próprios dados embora.
 */

import type { Metodologia } from "../core/metodologia.ts";
import type { Carga, Config, Sessao } from "./esquema.ts";
import * as repos from "./repos.ts";

export interface Exportacao {
  formato: "fichatreino/v1";
  geradoEm: string;
  uid: string;
  config: Config | null;
  metodologiaVersao: string;
  sessoes: Sessao[];
  cargas: Record<string, Carga>;
  overrides: Record<number, Record<string, string>>;
}

export async function montarExportacao(uid: string, agora = new Date()): Promise<Exportacao> {
  const config = (await repos.lerConfig(uid)) ?? null;
  const versao = config?.metodologiaVersao ?? "v1";

  const [sessoes, cargas, overrides] = await Promise.all([
    repos.sessoesRecentes(uid, Number.MAX_SAFE_INTEGER),
    repos.lerCargas(uid),
    repos.lerTodosOverrides(uid),
  ]);

  return {
    formato: "fichatreino/v1",
    geradoEm: agora.toISOString(),
    uid,
    config,
    metodologiaVersao: versao,
    sessoes,
    cargas,
    overrides,
  };
}

/** Só a metodologia, para conferir contra a saída do CLI. */
export const exportarMetodologia = (versao: string): Promise<Metodologia | undefined> =>
  repos.lerMetodologia(versao);

export function nomeDoArquivo(agora = new Date()): string {
  const data = agora.toISOString().slice(0, 10);
  return `fichatreino-${data}.json`;
}

/** Dispara o download no browser. */
export function baixarJson(dados: unknown, nome: string): void {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();

  // Sem revoke o blob fica retido na memória da aba até o reload.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
