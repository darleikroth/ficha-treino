<script setup lang="ts">
import { watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useAuthStore } from "../stores/auth.ts";

const auth = useAuthStore();
const router = useRouter();
const rota = useRoute();

const destino = () => (rota.query.redirecionar as string) || "/";

// Já autenticado (ou acabou de entrar): sai da tela de login.
watch(
  () => auth.autenticado,
  (sim) => {
    if (sim) void router.replace(destino());
  },
  { immediate: true },
);
</script>

<template>
  <main class="pagina pagina--centro login">
    <h1 class="login__marca">FichaTreino</h1>
    <p class="login__sub">Controle de treino de hipertrofia</p>

    <button
      class="login__botao"
      type="button"
      :disabled="auth.entrando || auth.carregando"
      @click="auth.entrar()"
    >
      {{ auth.entrando ? "Entrando…" : "Entrar com Google" }}
    </button>

    <p v-if="auth.erro" class="login__erro" role="alert">{{ auth.erro }}</p>
  </main>
</template>

<style scoped>
.login {
  gap: 0.5rem;
  padding-inline: 1.5rem;
}

.login__marca {
  margin: 0;
  font-size: 2rem;
  letter-spacing: -0.02em;
}

.login__sub {
  margin: 0 0 2rem;
  color: var(--texto-suave);
}

.login__botao {
  width: 100%;
  max-width: 20rem;
  padding: 0.875rem 1.25rem;
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  background: var(--acento);
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
}

.login__botao:disabled {
  opacity: 0.6;
}

.login__erro {
  max-width: 20rem;
  margin-top: 1rem;
  color: var(--perigo);
  font-size: 0.9375rem;
}
</style>
