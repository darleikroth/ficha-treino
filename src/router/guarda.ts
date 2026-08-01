import { watch } from "vue";
import type { RouteLocationNormalized, RouteLocationRaw } from "vue-router";

declare module "vue-router" {
  interface RouteMeta {
    /** Rota acessível sem sessão. Hoje, só `/login`. */
    publica?: boolean;
  }
}

/**
 * Política do guard, separada da fiação do router para poder ser testada sem
 * subir Firebase. O que se quer travar em teste é a *ordem*: decidir antes da
 * resolução de `onAuthStateChanged` faz o app piscar `/login` a cada abertura
 * offline, mesmo com sessão válida na persistência local (DD-A12).
 */
export interface EstadoSessao {
  carregando: boolean;
  autenticado: boolean;
}

/** Resolve no primeiro instante em que a sessão deixa de estar carregando. */
export function aguardarResolucao(sessao: EstadoSessao): Promise<void> {
  if (!sessao.carregando) return Promise.resolve();

  return new Promise((resolve) => {
    const parar = watch(
      () => sessao.carregando,
      (ainda) => {
        if (ainda) return;
        parar();
        resolve();
      },
    );
  });
}

type Destino = Pick<RouteLocationNormalized, "fullPath" | "meta">;

export function decidirRota(sessao: EstadoSessao, destino: Destino): true | RouteLocationRaw {
  if (sessao.autenticado) {
    // Já logado não tem o que fazer na tela de login.
    return destino.meta.publica ? { name: "home" } : true;
  }

  return destino.meta.publica
    ? true
    : { name: "login", query: { redirecionar: destino.fullPath } };
}
