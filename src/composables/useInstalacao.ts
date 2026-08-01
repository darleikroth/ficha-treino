import { onScopeDispose, readonly, ref } from "vue";

interface EventoDeInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Instalação como PWA.
 *
 * O `beforeinstallprompt` dispara **cedo**, logo depois de o Chrome processar o
 * manifest — bem antes de o usuário abrir a tela de Ajustes, que é lazy. Se o
 * listener só existisse dentro do composable, o evento já teria passado e o
 * botão de instalar nunca habilitaria. Por isso a captura acontece no import
 * deste módulo, que `main.ts` carrega no boot, e o evento fica guardado até
 * alguém querer usá-lo.
 *
 * O iOS não dispara este evento nem mostra prompt: lá o caminho é manual, via
 * Compartilhar → Adicionar à Tela de Início. Sem instrução explícita, usuário
 * de iPhone nunca descobre que dá para instalar — e o app instalado tem
 * garantia de storage melhor que a aba do Safari, o que importa para a eviction
 * de IndexedDB.
 */

const guardado = ref<EventoDeInstalacao | null>(null);
const instaladoAgora = ref(false);

function estaEmModoApp(): boolean {
  if (typeof globalThis.matchMedia !== "function") return false;
  return (
    globalThis.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

// Efeito de import: precisa rodar no boot, antes de o evento acontecer.
globalThis.addEventListener?.("beforeinstallprompt", (evento) => {
  evento.preventDefault();
  guardado.value = evento as EventoDeInstalacao;
});

globalThis.addEventListener?.("appinstalled", () => {
  instaladoAgora.value = true;
  guardado.value = null;
});

export function useInstalacao() {
  const instalado = ref(estaEmModoApp() || instaladoAgora.value);

  const ehIos =
    typeof navigator !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !/crios|fxios/i.test(navigator.userAgent);

  const sincronizar = () => {
    instalado.value = estaEmModoApp() || instaladoAgora.value;
  };
  globalThis.addEventListener?.("appinstalled", sincronizar);
  onScopeDispose(() => globalThis.removeEventListener?.("appinstalled", sincronizar));

  async function instalar(): Promise<void> {
    const evento = guardado.value;
    if (!evento) return;

    await evento.prompt();
    const { outcome } = await evento.userChoice;
    if (outcome === "accepted") instaladoAgora.value = true;
    guardado.value = null;
    sincronizar();
  }

  /** iOS precisa de instrução manual; o resto do mundo tem botão. */
  const precisaDeInstrucaoManual = () => ehIos && !instalado.value;

  return {
    podeInstalar: readonly(guardado),
    instalado,
    ehIos,
    instalar,
    precisaDeInstrucaoManual,
  };
}
