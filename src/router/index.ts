import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

import { useAuthStore } from "../stores/auth.ts";
import { aguardarResolucao, decidirRota } from "./guarda.ts";

/**
 * Rotas de ARQUITETURA §7.
 *
 * O guard de autenticação entra na Fase 3 e precisa esperar a resolução de
 * `onAuthStateChanged` antes de decidir — redirecionar durante o estado
 * `carregando` faz o app piscar `/login` a cada abertura offline.
 */
const rotas: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "login",
    component: () => import("../views/Login.vue"),
    meta: { publica: true },
  },
  { path: "/", name: "home", component: () => import("../views/Home.vue") },
  {
    path: "/treino/:treinoId",
    name: "treino",
    component: () => import("../views/Treino.vue"),
    props: true,
  },
  { path: "/ciclo", name: "ciclo", component: () => import("../views/Ciclo.vue") },
  { path: "/historico", name: "historico", component: () => import("../views/Historico.vue") },
  { path: "/config", name: "config", component: () => import("../views/Config.vue") },
  { path: "/:qualquer(.*)*", redirect: { name: "home" } },
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: rotas,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (destino) => {
  const auth = useAuthStore();
  auth.iniciar();

  // O await é o ponto todo: o primeiro disparo de onAuthStateChanged vem da
  // persistência local, sem rede. Decidir antes dele faz o app piscar /login a
  // cada abertura offline (DD-A12).
  await aguardarResolucao(auth);

  return decidirRota(auth, destino);
});

export default router;
