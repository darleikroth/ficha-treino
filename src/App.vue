<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

import BannerAtualizacao from "./components/BannerAtualizacao.vue";
import { useInicializacao } from "./composables/useInicializacao.ts";

const rota = useRoute();

// Liga config → metodologia → ciclo → sync assim que houver uid, e desliga no logout.
useInicializacao();

// Login ocupa a tela inteira; a execução do treino também, para não competir por
// espaço com os botões de registrar série.
const semNavegacao = computed(() => rota.name === "login" || rota.name === "treino");

const abas = [
  { nome: "home", rotulo: "Hoje", icone: "◉" },
  { nome: "ciclo", rotulo: "Ciclo", icone: "◇" },
  { nome: "historico", rotulo: "Histórico", icone: "▤" },
  { nome: "config", rotulo: "Ajustes", icone: "⚙" },
] as const;
</script>

<template>
  <div class="app" :class="{ 'app--sem-nav': semNavegacao }">
    <!-- Fora do RouterView: a atualização vale em qualquer tela, inclusive na
         de login e na de execução do treino. -->
    <BannerAtualizacao />

    <RouterView v-slot="{ Component }">
      <component :is="Component" />
    </RouterView>

    <nav v-if="!semNavegacao" class="nav">
      <RouterLink
        v-for="aba in abas"
        :key="aba.nome"
        class="nav__item"
        :to="{ name: aba.nome }"
      >
        <span class="nav__icone" aria-hidden="true">{{ aba.icone }}</span>
        <span class="nav__rotulo">{{ aba.rotulo }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.app {
  min-height: 100dvh;
  /* espaço para a barra fixa + a barra de gestos do iPhone */
  padding-bottom: calc(4.25rem + var(--safe-bottom));
}

.app--sem-nav {
  padding-bottom: 0;
}

.nav {
  position: fixed;
  inset: auto 0 0 0;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 0.25rem;
  padding: 0.375rem 0.5rem calc(0.375rem + var(--safe-bottom));
  background: var(--fundo-elevado);
  border-top: 1px solid var(--borda);
}

.nav__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.125rem;
  min-height: var(--toque-min);
  padding: 0.25rem;
  border-radius: var(--raio);
  color: var(--texto-suave);
  text-decoration: none;
  font-size: 0.75rem;
}

.nav__item.router-link-active {
  color: var(--acento);
  background: color-mix(in srgb, var(--acento) 12%, transparent);
}

.nav__icone {
  font-size: 1.125rem;
  line-height: 1;
}
</style>
