<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { useAuthStore } from "../stores/auth.ts";
import { useHistoricoStore } from "../stores/historico.ts";

const auth = useAuthStore();
const historico = useHistoricoStore();

const aba = ref<"sessoes" | "exercicios">("sessoes");
const exercicioAberto = ref<string | null>(null);

onMounted(() => {
  if (auth.uid) void historico.carregar(auth.uid);
});

const formatarData = (ms: number) =>
  new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

const formatarPeso = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

const duracao = (inicio: number, fim: number | null) => {
  if (!fim) return "—";
  const minutos = Math.round((fim - inicio) / 60000);
  return minutos >= 60 ? `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, "0")}` : `${minutos} min`;
};

const vazio = computed(() => !historico.carregando && historico.concluidas.length === 0);
</script>

<template>
  <main class="pagina">
    <h1>Histórico</h1>

    <div class="abas" role="tablist">
      <button
        class="abas__item"
        :class="{ 'abas__item--ativa': aba === 'sessoes' }"
        role="tab"
        :aria-selected="aba === 'sessoes'"
        @click="aba = 'sessoes'"
      >
        Sessões
      </button>
      <button
        class="abas__item"
        :class="{ 'abas__item--ativa': aba === 'exercicios' }"
        role="tab"
        :aria-selected="aba === 'exercicios'"
        @click="aba = 'exercicios'"
      >
        Progressão
      </button>
    </div>

    <p v-if="historico.carregando" class="pendente">Carregando…</p>
    <p v-else-if="vazio" class="pendente">
      Nenhum treino concluído ainda. O histórico aparece aqui depois da primeira sessão.
    </p>

    <section v-else-if="aba === 'sessoes'" class="sessoes">
      <article v-for="s in historico.concluidas" :key="s.id" class="sessao">
        <div class="sessao__topo">
          <strong>{{ s.treinoId }}</strong>
          <span class="sessao__data">{{ formatarData(s.inicioEm) }}</span>
        </div>
        <!-- Sessão do modo simples (DD-A18) não tem séries: mostra exercícios marcados. -->
        <p class="sessao__meta">
          Ciclo {{ s.ciclo }} · Semana {{ s.semana }} ·
          <template v-if="historico.totalDeSeries(s)">
            {{ historico.totalDeSeries(s) }} séries ·
            {{ formatarPeso(historico.volumeDaSessao(s)) }} kg de volume ·
          </template>
          <template v-else>{{ historico.totalDeExercicios(s) }} exercícios · </template>
          {{ duracao(s.inicioEm, s.fimEm) }}
        </p>
      </article>
    </section>

    <section v-else class="exercicios">
      <article v-for="ex in historico.porExercicio" :key="ex.exercicioId" class="exercicio">
        <button
          class="exercicio__cabecalho"
          type="button"
          :aria-expanded="exercicioAberto === ex.exercicioId"
          @click="exercicioAberto = exercicioAberto === ex.exercicioId ? null : ex.exercicioId"
        >
          <span class="exercicio__nome">{{ ex.nome }}</span>
          <span class="exercicio__numeros">
            {{ formatarPeso(ex.ultimoPeso) }} kg
            <span class="exercicio__e1rm">· e1RM {{ formatarPeso(ex.melhorE1rm) }}</span>
          </span>
        </button>

        <ol v-if="exercicioAberto === ex.exercicioId" class="pontos">
          <li v-for="(p, i) in [...ex.pontos].reverse()" :key="i" class="pontos__item">
            <span>{{ formatarData(p.data) }}</span>
            <span>{{ formatarPeso(p.peso) }} kg × {{ p.reps }}</span>
            <span class="pontos__e1rm">{{ formatarPeso(p.e1rm) }}</span>
          </li>
        </ol>
      </article>
    </section>
  </main>
</template>

<style scoped>
.abas {
  display: flex;
  gap: 0.375rem;
  margin-bottom: 1rem;
}

.abas__item {
  flex: 1;
  min-height: var(--toque-min);
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  background: none;
  color: var(--texto-suave);
  font-size: 0.9375rem;
}

.abas__item--ativa {
  border-color: var(--acento);
  color: var(--acento);
  background: color-mix(in srgb, var(--acento) 12%, transparent);
}

.sessoes,
.exercicios {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sessao {
  padding: 0.75rem;
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  background: var(--fundo-elevado);
}

.sessao__topo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.sessao__data {
  color: var(--texto-suave);
  font-size: 0.8125rem;
}

.sessao__meta {
  margin: 0.25rem 0 0;
  color: var(--texto-suave);
  font-size: 0.8125rem;
}

.exercicio {
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  background: var(--fundo-elevado);
  overflow: hidden;
}

.exercicio__cabecalho {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  min-height: var(--toque-min);
  padding: 0.625rem 0.75rem;
  border: none;
  background: none;
  text-align: left;
}

.exercicio__nome {
  font-size: 0.9375rem;
}

.exercicio__numeros {
  color: var(--texto-suave);
  font-size: 0.8125rem;
  white-space: nowrap;
}

.exercicio__e1rm {
  opacity: 0.75;
}

.pontos {
  margin: 0;
  padding: 0;
  list-style: none;
}

.pontos__item {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.75rem;
  padding: 0.375rem 0.75rem;
  border-top: 1px solid var(--borda);
  color: var(--texto-suave);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

.pontos__e1rm {
  color: var(--acento);
}
</style>
