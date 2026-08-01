import { defineStore } from "pinia";
import { ref } from "vue";

import type { Slot } from "../core/estrutura.ts";
import { sugerirCarga, type Sugestao } from "../core/progressao.ts";
import type { Carga } from "../db/esquema.ts";
import { aoMudar } from "../db/eventos.ts";
import * as repos from "../db/repos.ts";
import { useConfigStore } from "./config.ts";

/**
 * Última carga por exercício (DD-A10).
 *
 * Denormalizado de propósito: abrir um treino precisa da última carga de ~8
 * exercícios instantaneamente e offline. Derivar isso varrendo sessões exigiria
 * ter o histórico completo local.
 */
export const useCargasStore = defineStore("cargas", () => {
  const mapa = ref<Record<string, Carga>>({});
  const carregando = ref(false);

  const config = useConfigStore();

  let cancelar: (() => void) | null = null;

  async function carregar(uid: string): Promise<void> {
    carregando.value = true;
    try {
      mapa.value = await repos.lerCargas(uid);

      cancelar?.();
      cancelar = aoMudar((colecao) => {
        if (colecao === "cargas") void recarregar(uid);
      });
    } finally {
      carregando.value = false;
    }
  }

  async function recarregar(uid: string): Promise<void> {
    mapa.value = await repos.lerCargas(uid);
  }

  /** Sempre editável e nunca persistida como registro (DD-A09). */
  function sugestao(exercicioId: string, slot: Pick<Slot, "reps">): Sugestao {
    return sugerirCarga(slot, mapa.value[exercicioId], config.incremento);
  }

  const ultima = (exercicioId: string): Carga | undefined => mapa.value[exercicioId];

  function parar(): void {
    cancelar?.();
    cancelar = null;
  }

  return { mapa, carregando, carregar, recarregar, sugestao, ultima, parar };
});
