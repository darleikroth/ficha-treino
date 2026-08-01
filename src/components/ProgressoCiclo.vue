<script setup lang="ts">
import { useCicloStore } from "../stores/ciclo.ts";

const ciclo = useCicloStore();
</script>

<template>
  <section class="progresso">
    <div class="progresso__topo">
      <strong>Ciclo {{ ciclo.cicloAtual }}</strong>
      <span class="progresso__semana">
        Semana {{ ciclo.semanaAtual }} de {{ ciclo.semanasPorCiclo }}
      </span>
    </div>

    <div
      class="progresso__barra"
      role="progressbar"
      :aria-valuenow="ciclo.semanaAtual"
      :aria-valuemin="1"
      :aria-valuemax="ciclo.semanasPorCiclo"
    >
      <div class="progresso__preenchido" :style="{ width: `${ciclo.progressoDoCiclo.fracao * 100}%` }" />
    </div>

    <p v-if="ciclo.faseProgressao" class="progresso__fase">
      <strong>{{ ciclo.faseProgressao.rir }}</strong>
      <span class="progresso__nota">{{ ciclo.faseProgressao.nota }}</span>
    </p>

    <p class="progresso__sessoes">
      {{ ciclo.sessoesConcluidas }} sessão(ões) concluída(s) neste ciclo
    </p>
  </section>
</template>

<style scoped>
.progresso {
  padding: 1rem;
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  background: var(--fundo-elevado);
}

.progresso__topo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.progresso__semana {
  color: var(--texto-suave);
  font-size: 0.875rem;
}

.progresso__barra {
  height: 0.5rem;
  margin: 0.75rem 0;
  border-radius: 999px;
  background: var(--borda);
  overflow: hidden;
}

.progresso__preenchido {
  height: 100%;
  background: var(--acento);
}

.progresso__fase {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  margin: 0;
}

.progresso__nota {
  color: var(--texto-suave);
  font-size: 0.875rem;
}

.progresso__sessoes {
  margin: 0.5rem 0 0;
  color: var(--texto-suave);
  font-size: 0.8125rem;
}
</style>
