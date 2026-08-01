import { ref, watch } from "vue";

import { useAuthStore } from "../stores/auth.ts";
import { useCargasStore } from "../stores/cargas.ts";
import { useCicloStore } from "../stores/ciclo.ts";
import { useConfigStore } from "../stores/config.ts";
import { useMetodologiaStore } from "../stores/metodologia.ts";
import { useSessaoStore } from "../stores/sessao.ts";
import { useSyncStore } from "../stores/sync.ts";

/**
 * Liga as camadas quando o usuário aparece, e desliga quando some.
 *
 * A ordem importa: config primeiro (traz `metodologiaVersao` e
 * `indisponiveis`), depois metodologia (o gerador depende dos dois), depois
 * ciclo, e só então o sync — que abre listeners contra a versão certa.
 */
export function useInicializacao() {
  const auth = useAuthStore();
  const config = useConfigStore();
  const met = useMetodologiaStore();
  const ciclo = useCicloStore();
  const cargas = useCargasStore();
  const sessao = useSessaoStore();
  const sync = useSyncStore();

  const pronto = ref(false);
  const erro = ref<string | null>(null);

  async function ligar(uid: string): Promise<void> {
    pronto.value = false;
    erro.value = null;
    try {
      // Antes de tudo: sem persistência concedida, o iOS pode evictar o
      // IndexedDB depois de ~7 dias sem uso (ARQUITETURA §5).
      void config.pedirArmazenamentoPersistente();

      await config.carregar(uid);
      await met.carregar(uid, config.metodologiaVersao);
      await ciclo.carregar(uid);
      await cargas.carregar(uid);
      await sessao.carregar(uid);
      sync.iniciar(uid, config.metodologiaVersao);
      pronto.value = true;
    } catch (e) {
      erro.value = e instanceof Error ? e.message : String(e);
    }
  }

  function desligar(): void {
    sync.parar();
    sessao.parar();
    cargas.parar();
    ciclo.parar();
    met.parar();
    config.parar();
    pronto.value = false;
  }

  watch(
    () => auth.uid,
    (uid, anterior) => {
      if (anterior && anterior !== uid) desligar();
      if (uid) void ligar(uid);
    },
    { immediate: true },
  );

  return { pronto, erro };
}
