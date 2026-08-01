<script setup lang="ts">
import { computed } from "vue";

import IndicadorSync from "../components/IndicadorSync.vue";
import ProgressoCiclo from "../components/ProgressoCiclo.vue";
import { useCicloStore } from "../stores/ciclo.ts";
import { useMetodologiaStore } from "../stores/metodologia.ts";

const ciclo = useCicloStore();
const met = useMetodologiaStore();

/**
 * Treino sugerido: o primeiro da ordem que ainda não foi concluído nesta
 * semana. Sem sessões, é o T1.
 */
const sugerido = computed(() => {
  const treinos = ciclo.ciclo?.treinos ?? [];
  if (!treinos.length) return null;
  const indice = ciclo.sessoesConcluidas % treinos.length;
  return treinos[indice];
});

const contagemDeSlots = (treinoId: string) =>
  ciclo.treino(treinoId)?.itens.filter((i) => !i.slot.opcional).length ?? 0;
</script>

<template>
  <main class="pagina">
    <header class="topo">
      <h1>Hoje</h1>
      <IndicadorSync />
    </header>

    <p v-if="!met.pronta" class="pendente">Carregando metodologia…</p>

    <template v-else>
      <ProgressoCiclo />

      <section v-if="sugerido" class="sugerido">
        <p class="sugerido__rotulo">Próximo treino</p>
        <h2 class="sugerido__titulo">{{ sugerido.meta.id }} · {{ sugerido.meta.titulo }}</h2>
        <p class="sugerido__objetivo">{{ sugerido.meta.objetivo }}</p>
        <p class="sugerido__meta">
          {{ sugerido.meta.dia }} · {{ contagemDeSlots(sugerido.meta.id) }} exercícios ·
          descanso {{ sugerido.meta.descanso }}
        </p>

        <RouterLink
          class="sugerido__botao"
          :to="{ name: 'treino', params: { treinoId: sugerido.meta.id } }"
        >
          Iniciar treino
        </RouterLink>
      </section>

      <section class="outros">
        <h2 class="outros__titulo">Os cinco treinos do ciclo</h2>
        <RouterLink
          v-for="t in ciclo.ciclo?.treinos ?? []"
          :key="t.meta.id"
          class="outros__item"
          :to="{ name: 'treino', params: { treinoId: t.meta.id } }"
        >
          <span class="outros__id">{{ t.meta.id }}</span>
          <span class="outros__nome">{{ t.meta.titulo }}</span>
          <span class="outros__dia">{{ t.meta.dia }}</span>
        </RouterLink>
      </section>

      <p v-if="met.doBundle" class="aviso-bundle">
        Usando a metodologia embutida no app — ainda não sincronizou com o servidor.
      </p>
    </template>
  </main>
</template>

<style scoped>
.topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.topo h1 {
  margin: 0;
}

.sugerido {
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  background: var(--fundo-elevado);
}

.sugerido__rotulo {
  margin: 0;
  color: var(--texto-suave);
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sugerido__titulo {
  margin: 0.25rem 0;
  font-size: 1.25rem;
}

.sugerido__objetivo {
  margin: 0;
  color: var(--texto-suave);
}

.sugerido__meta {
  margin: 0.5rem 0 1rem;
  color: var(--texto-suave);
  font-size: 0.8125rem;
}

/* Alvo grande: é o botão que se aperta com a mão suada, entre séries. */
.sugerido__botao {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 3.25rem;
  border-radius: var(--raio);
  background: var(--acento);
  color: #fff;
  font-size: 1.0625rem;
  font-weight: 600;
  text-decoration: none;
}

.outros {
  margin-top: 1.5rem;
}

.outros__titulo {
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
  color: var(--texto-suave);
  font-weight: 500;
}

.outros__item {
  display: grid;
  grid-template-columns: 2.5rem 1fr auto;
  align-items: center;
  gap: 0.75rem;
  min-height: var(--toque-min);
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  margin-bottom: 0.5rem;
  color: inherit;
  text-decoration: none;
}

.outros__id {
  color: var(--acento);
  font-weight: 600;
  font-size: 0.875rem;
}

.outros__dia {
  color: var(--texto-suave);
  font-size: 0.8125rem;
}

.aviso-bundle {
  margin-top: 1.5rem;
  color: var(--texto-suave);
  font-size: 0.8125rem;
}
</style>
