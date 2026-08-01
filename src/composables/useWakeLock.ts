import { onScopeDispose, ref } from "vue";

/**
 * Mantém a tela acesa durante o treino.
 *
 * O lock é solto pelo browser quando a aba vai para segundo plano, e **não é
 * restaurado sozinho** ao voltar — daí o listener de `visibilitychange`. Sem
 * isso a tela apaga na segunda vez que o usuário guarda o celular no bolso.
 */
export function useWakeLock() {
  const ativo = ref(false);
  const suportado = typeof navigator !== "undefined" && "wakeLock" in navigator;

  let sentinela: WakeLockSentinel | null = null;
  let desejado = false;

  async function pedir(): Promise<void> {
    if (!suportado || sentinela) return;
    try {
      sentinela = await navigator.wakeLock.request("screen");
      ativo.value = true;
      sentinela.addEventListener("release", () => {
        ativo.value = false;
        sentinela = null;
      });
    } catch {
      // Bateria fraca ou permissão negada: seguir sem, nunca quebrar o treino.
      ativo.value = false;
    }
  }

  async function ativar(): Promise<void> {
    desejado = true;
    await pedir();
  }

  async function liberar(): Promise<void> {
    desejado = false;
    try {
      await sentinela?.release();
    } catch {
      // já liberado
    }
    sentinela = null;
    ativo.value = false;
  }

  const aoVoltar = () => {
    if (desejado && document.visibilityState === "visible") void pedir();
  };
  globalThis.addEventListener?.("visibilitychange", aoVoltar);

  onScopeDispose(() => {
    globalThis.removeEventListener?.("visibilitychange", aoVoltar);
    void liberar();
  });

  return { ativo, suportado, ativar, liberar };
}
