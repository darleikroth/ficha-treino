import { ref } from "vue";
import { useRegisterSW } from "virtual:pwa-register/vue";

/**
 * Detecção e aplicação de nova versão do app.
 *
 * Com `registerType: 'prompt'`, o service worker novo fica em `waiting` em vez
 * de assumir sozinho — nada recarrega no meio de uma série. Quem decide a hora
 * é o usuário, pelo `BannerAtualizacao`.
 *
 * Chamado uma vez só: `useRegisterSW` registra o SW, e chamar de novo criaria
 * registros duplicados. Por isso o estado vive no módulo, não na instância.
 */

/** De quanto em quanto tempo perguntar ao servidor se há versão nova. */
const INTERVALO_DE_CHECAGEM_MS = 60 * 60 * 1000;

const aplicando = ref(false);
const erro = ref<string | null>(null);

let registro: ServiceWorkerRegistration | undefined;

async function checar(): Promise<void> {
  if (!registro) return;
  try {
    await registro.update();
  } catch {
    // Offline ou servidor fora: tentar de novo no próximo ciclo, em silêncio.
  }
}

const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
  onRegisteredSW(_url, r) {
    registro = r;
    if (!r) return;

    // Sem isto o SW só reconsulta em navegação. Um PWA instalado pode passar
    // dias aberto sem nunca perceber que existe versão nova.
    setInterval(checar, INTERVALO_DE_CHECAGEM_MS);

    // Voltar do segundo plano é o melhor momento para checar: é quando o
    // usuário abre o app de novo, tipicamente já em outra sessão de treino.
    globalThis.addEventListener?.("visibilitychange", () => {
      if (document.visibilityState === "visible") void checar();
    });
  },

  onRegisterError(e) {
    erro.value = e instanceof Error ? e.message : String(e);
  },
});

export function useAtualizacao() {
  /**
   * Aplica a versão nova.
   *
   * `updateServiceWorker(true)` manda o SW em espera assumir e recarrega a
   * página. O reload passa a buscar `index.html` (servido com `no-cache`), que
   * aponta para os JS e CSS com hash novo, e o precache do SW novo já os tem.
   *
   * O `location.reload()` é rede de segurança: se o SW não responder — foi
   * descartado, deu erro, o browser não suporta —, sem ele o botão não faria
   * nada e o usuário ficaria preso na versão velha, que é exatamente o que
   * este banner existe para evitar.
   */
  async function atualizar(): Promise<void> {
    if (aplicando.value) return;
    aplicando.value = true;
    erro.value = null;

    const salvaVidas = setTimeout(() => globalThis.location?.reload(), 3000);

    try {
      await updateServiceWorker(true);
    } catch (e) {
      erro.value = e instanceof Error ? e.message : String(e);
      clearTimeout(salvaVidas);
      globalThis.location?.reload();
    }
  }

  function dispensar(): void {
    needRefresh.value = false;
  }

  return {
    temAtualizacao: needRefresh,
    prontoOffline: offlineReady,
    aplicando,
    erro,
    atualizar,
    dispensar,
    checar,
  };
}
