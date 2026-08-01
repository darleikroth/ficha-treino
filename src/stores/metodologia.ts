import { defineStore } from "pinia";
import { computed, ref, shallowRef } from "vue";

import { criarGerador, type CiclosFixos, type Gerador } from "../core/gerador.ts";
import { METODOLOGIA_V1, type Metodologia } from "../core/metodologia.ts";
import { aoMudar } from "../db/eventos.ts";
import * as repos from "../db/repos.ts";
import { CHAVE_METODOLOGIA_DO_SERVIDOR } from "../firebase/sync.ts";
import { useConfigStore } from "./config.ts";

/**
 * Metodologia e gerador.
 *
 * O gerador é `computed`: trocar `indisponiveis` ou um override reconstrói a
 * função pura e pronto. Não há estado derivado para invalidar, porque o ciclo
 * não é dado armazenado — é computado.
 */
export const useMetodologiaStore = defineStore("metodologia", () => {
  const metodologia = shallowRef<Metodologia | null>(null);
  const overrides = ref<CiclosFixos>({});
  const carregando = ref(false);

  /**
   * Se o RTDB já entregou a metodologia alguma vez.
   *
   * Não dá para inferir de onde veio o objeto em memória: o fallback do bundle
   * e o listener gravam pelo mesmo `gravarMetodologia`. Quem carimba a
   * procedência é `firebase/sync.ts`.
   */
  const doServidorEm = ref<number | null>(null);
  const doBundle = computed(() => doServidorEm.value === null);

  const config = useConfigStore();

  const gerador = computed<Gerador | null>(() => {
    if (!metodologia.value) return null;
    return criarGerador(metodologia.value, {
      indisponiveis: config.indisponiveis,
      ciclosFixos: overrides.value,
    });
  });

  const pronta = computed(() => gerador.value !== null);

  let cancelar: (() => void) | null = null;

  /**
   * Carrega do IndexedDB e cai no bundle se não houver nada.
   *
   * O fallback é o que faz o primeiro acesso sem rede funcionar: sem ele o app
   * abriria vazio até o listener do RTDB responder, que offline é nunca.
   */
  async function carregar(uid: string, versao: string): Promise<void> {
    carregando.value = true;
    try {
      const salva = await repos.lerMetodologia(versao);

      if (salva?.slots?.length) {
        metodologia.value = salva;
      } else {
        metodologia.value = METODOLOGIA_V1;
        if (versao === METODOLOGIA_V1.versao) await repos.gravarMetodologia(METODOLOGIA_V1);
      }

      doServidorEm.value = (await repos.lerMeta<number>(CHAVE_METODOLOGIA_DO_SERVIDOR)) ?? null;
      overrides.value = await repos.lerTodosOverrides(uid);

      cancelar?.();
      cancelar = aoMudar((colecao) => {
        if (colecao === "metodologia") void recarregarMetodologia(versao);
        if (colecao === "meta") void recarregarProcedencia();
        if (colecao === "overrides") void recarregarOverrides(uid);
      });
    } finally {
      carregando.value = false;
    }
  }

  async function recarregarMetodologia(versao: string): Promise<void> {
    const salva = await repos.lerMetodologia(versao);
    if (salva?.slots?.length) metodologia.value = salva;
  }

  async function recarregarProcedencia(): Promise<void> {
    doServidorEm.value = (await repos.lerMeta<number>(CHAVE_METODOLOGIA_DO_SERVIDOR)) ?? null;
  }

  async function recarregarOverrides(uid: string): Promise<void> {
    overrides.value = await repos.lerTodosOverrides(uid);
  }

  function parar(): void {
    cancelar?.();
    cancelar = null;
  }

  return {
    metodologia,
    overrides,
    gerador,
    pronta,
    carregando,
    doBundle,
    doServidorEm,
    carregar,
    recarregarOverrides,
    recarregarProcedencia,
    parar,
  };
});
