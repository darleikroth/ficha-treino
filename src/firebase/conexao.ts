/**
 * Observador de conectividade.
 *
 * `navigator.onLine` só sabe se existe interface de rede — diz `true` num wifi
 * de academia que não roteia nada. `.info/connected` é o que o RTDB realmente
 * enxerga, e é o gatilho certo para drenar o outbox.
 */

import { onValue, ref as refDo } from "firebase/database";

import { obterBd } from "./app.ts";

export function observarConexao(aoMudar: (online: boolean) => void): () => void {
  const conectado = refDo(obterBd(), ".info/connected");

  const cancelarRtdb = onValue(conectado, (snap) => aoMudar(snap.val() === true));

  // O evento do browser não substitui o de cima, mas antecipa a queda: o RTDB
  // pode levar dezenas de segundos para perceber que o socket morreu.
  const aoCair = () => aoMudar(false);
  globalThis.addEventListener?.("offline", aoCair);

  return () => {
    cancelarRtdb();
    globalThis.removeEventListener?.("offline", aoCair);
  };
}

/** Diferença de relógio estimada pelo servidor, em ms. */
export function observarDeslocamentoDeRelogio(aoMudar: (ms: number) => void): () => void {
  return onValue(refDo(obterBd(), ".info/serverTimeOffset"), (snap) => {
    aoMudar(Number(snap.val() ?? 0));
  });
}
