import { defineStore } from "pinia";
import { computed, ref } from "vue";

import type { Config } from "../db/esquema.ts";
import { aoMudar } from "../db/eventos.ts";
import * as repos from "../db/repos.ts";
import { VERSAO_GERADOR, VERSAO_METODOLOGIA_PADRAO } from "../versao.ts";

/**
 * Config do usuário.
 *
 * Não está na lista de stores de ARQUITETURA §6, mas duas delas precisam do
 * mesmo objeto — `metodologia` lê `indisponiveis`, `ciclo` lê `cicloAtual` e
 * `semanaManual`. Fatiar isso entre as duas criaria dependência cruzada.
 */
export const padraoDeConfig = (uid: string): Config => ({
  uid,
  metodologiaVersao: VERSAO_METODOLOGIA_PADRAO,
  geradorVersao: VERSAO_GERADOR,
  cicloAtual: 1,
  semanaManual: null,
  incrementoPadrao: 2.5,
  unidade: "kg",
  modoRegistro: "simples",
  indisponiveis: {},
  atualizadoEm: 0,
});

export const useConfigStore = defineStore("config", () => {
  const config = ref<Config | null>(null);
  const carregando = ref(false);

  const metodologiaVersao = computed(
    () => config.value?.metodologiaVersao ?? VERSAO_METODOLOGIA_PADRAO,
  );

  /** Ids filtrados na geração do ciclo — equipamento quebrado, academia sem a máquina. */
  const indisponiveis = computed(() =>
    Object.entries(config.value?.indisponiveis ?? {})
      .filter(([, ativo]) => ativo)
      .map(([id]) => id),
  );

  const incremento = computed(() => config.value?.incrementoPadrao ?? 2.5);

  /** DD-A18: configs gravadas antes do campo existir caem no modo simples. */
  const modoRegistro = computed(() => config.value?.modoRegistro ?? "simples");

  let cancelar: (() => void) | null = null;

  async function carregar(uid: string): Promise<void> {
    carregando.value = true;
    try {
      const salva = await repos.lerConfig(uid);
      if (salva) {
        config.value = salva;
      } else {
        // Primeiro acesso: grava o padrão para que o RTDB tenha o nó e o
        // usuário apareça como existente nos dois lados.
        const nova = padraoDeConfig(uid);
        await repos.gravarConfig(nova);
        config.value = (await repos.lerConfig(uid)) ?? nova;
      }

      cancelar?.();
      cancelar = aoMudar((colecao) => {
        if (colecao === "config") void recarregar(uid);
      });
    } finally {
      carregando.value = false;
    }
  }

  /**
   * Conta escritas locais. Comparar `atualizadoEm` não basta: duas mudanças
   * seguidas caem no mesmo milissegundo e empatam.
   */
  let sequencia = 0;

  async function recarregar(uid: string): Promise<void> {
    const marca = sequencia;
    const atual = await repos.lerConfig(uid);
    if (!atual) return;

    // A releitura vem de evento e é assíncrona. Se uma escrita local aconteceu
    // enquanto ela estava em voo, aplicar o resultado reverteria o valor novo —
    // mexer em dois ajustes seguidos fazia o primeiro reaparecer na tela.
    if (marca !== sequencia) return;

    config.value = atual;
  }

  /** Grava um patch. `cicloAtual` NÃO passa por aqui — ver `ciclo.avancarCiclo`. */
  async function salvar(patch: Partial<Omit<Config, "uid" | "cicloAtual">>): Promise<void> {
    if (!config.value) throw new Error("Config ainda não carregada.");
    const atualizada: Config = { ...config.value, ...patch };
    sequencia += 1;
    config.value = atualizada;
    await repos.gravarConfig(atualizada);
  }

  async function definirIndisponivel(exercicioId: string, indisponivel: boolean): Promise<void> {
    const mapa = { ...(config.value?.indisponiveis ?? {}) };
    if (indisponivel) mapa[exercicioId] = true;
    else delete mapa[exercicioId];
    await salvar({ indisponiveis: mapa });
  }

  /**
   * Pede armazenamento persistente.
   *
   * O iOS Safari evicta IndexedDB depois de ~7 dias sem uso. Para quem treina
   * 5x por semana é irrelevante, mas custa uma chamada — e o app instalado tem
   * garantia melhor que a aba (ARQUITETURA §5).
   */
  async function pedirArmazenamentoPersistente(): Promise<boolean> {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return navigator.storage.persist();
  }

  /** Export completo, lido do IndexedDB: funciona offline. */
  async function exportar(uid: string): Promise<void> {
    const { baixarJson, montarExportacao, nomeDoArquivo } = await import("../db/exportar.ts");
    baixarJson(await montarExportacao(uid), nomeDoArquivo());
  }

  function parar(): void {
    cancelar?.();
    cancelar = null;
  }

  return {
    config,
    carregando,
    metodologiaVersao,
    indisponiveis,
    incremento,
    modoRegistro,
    carregar,
    recarregar,
    salvar,
    definirIndisponivel,
    pedirArmazenamentoPersistente,
    exportar,
    parar,
  };
});
