<script setup lang="ts">
import { computed, ref } from "vue";

import IndicadorSync from "../components/IndicadorSync.vue";
import { useAuthStore } from "../stores/auth.ts";
import { useCicloStore } from "../stores/ciclo.ts";
import { useMetodologiaStore } from "../stores/metodologia.ts";
import { useSyncStore } from "../stores/sync.ts";

const auth = useAuthStore();
const ciclo = useCicloStore();
const met = useMetodologiaStore();
const sync = useSyncStore();

const confirmandoAvanco = ref(false);

const ROTULO_GRUPO: Record<string, string> = {
  peito: "Peito",
  costas: "Costas",
  ombroAnterior: "Ombro ant.",
  ombroLateral: "Ombro lat.",
  ombroPosterior: "Ombro post.",
  biceps: "Bíceps",
  triceps: "Tríceps",
  quadriceps: "Quadríceps",
  isquios: "Isquios",
  gluteo: "Glúteo",
  panturrilha: "Panturrilha",
  adutores: "Adutores",
  lombar: "Lombar",
};

const volume = computed(() =>
  Object.entries(ciclo.volumeSemanal)
    .map(([grupo, series]) => ({ grupo, rotulo: ROTULO_GRUPO[grupo] ?? grupo, series }))
    .sort((a, b) => b.series - a.series),
);

const totalDeSeries = computed(() => volume.value.reduce((soma, v) => soma + v.series, 0));

async function confirmarAvanco() {
  if (!auth.uid) return;
  const avancou = await ciclo.avancarCiclo(auth.uid);
  if (avancou) confirmandoAvanco.value = false;
}
</script>

<template>
  <main class="pagina">
    <header class="topo">
      <h1>Ciclo {{ ciclo.cicloAtual }}</h1>
      <IndicadorSync />
    </header>

    <p v-if="!met.pronta" class="pendente">Carregando…</p>

    <template v-else>
      <p class="resumo">
        Semana {{ ciclo.semanaAtual }} de {{ ciclo.semanasPorCiclo }}
        <template v-if="ciclo.faseProgressao"> · {{ ciclo.faseProgressao.rir }}</template>
      </p>

      <section v-for="t in ciclo.ciclo?.treinos ?? []" :key="t.meta.id" class="treino">
        <h2 class="treino__titulo">
          <span class="treino__id">{{ t.meta.id }}</span>
          {{ t.meta.titulo }}
          <span class="treino__dia">{{ t.meta.dia }}</span>
        </h2>

        <ol class="itens">
          <li v-for="item in t.itens" :key="item.slot.id" class="item">
            <div class="item__alvo">{{ item.slot.alvo }}</div>
            <div class="item__nome">
              {{ item.exercicio?.nome ?? item.exercicioId }}
              <span v-if="item.slot.ancora" class="item__ancora" title="Âncora — não rotaciona">[Â]</span>
              <span v-if="item.slot.opcional" class="item__opcional">opcional</span>
            </div>
            <div class="item__series">{{ item.slot.series }} × {{ item.slot.reps }}</div>
          </li>
        </ol>
      </section>

      <section class="volume">
        <h2 class="volume__titulo">Volume semanal · {{ totalDeSeries }} séries</h2>
        <p class="volume__nota">
          Invariante por construção (DD-02): a rotação troca qual exercício ocupa o slot, nunca
          quantas séries ele tem.
        </p>
        <ul class="volume__lista">
          <li v-for="v in volume" :key="v.grupo" class="volume__item">
            <span>{{ v.rotulo }}</span>
            <strong>{{ v.series }}</strong>
          </li>
        </ul>
      </section>

      <section v-if="ciclo.avisos.length" class="avisos">
        <h2 class="avisos__titulo">Restrições relaxadas</h2>
        <ul>
          <li v-for="aviso in ciclo.avisos" :key="aviso">{{ aviso }}</li>
        </ul>
      </section>

      <section class="avancar">
        <h2 class="avancar__titulo">Avançar para o Ciclo {{ ciclo.cicloAtual + 1 }}</h2>
        <p class="avancar__nota">
          Rotaciona os acessórios e mantém as âncoras. Exige conexão — é o único ponto do app que
          exige, para dois aparelhos não avançarem o ciclo em separado.
        </p>

        <p v-if="ciclo.erro" class="avancar__erro" role="alert">{{ ciclo.erro }}</p>

        <template v-if="!confirmandoAvanco">
          <button
            class="botao botao--secundario"
            type="button"
            :disabled="!sync.online || ciclo.avancando"
            @click="confirmandoAvanco = true"
          >
            {{ sync.online ? "Avançar de ciclo" : "Avançar de ciclo (offline)" }}
          </button>
        </template>

        <template v-else>
          <p class="avancar__confirma">
            Isto troca os exercícios acessórios de todos os cinco treinos. Confirma?
          </p>
          <div class="avancar__acoes">
            <button class="botao" type="button" :disabled="ciclo.avancando" @click="confirmarAvanco">
              {{ ciclo.avancando ? "Avançando…" : "Sim, avançar" }}
            </button>
            <button
              class="botao botao--secundario"
              type="button"
              :disabled="ciclo.avancando"
              @click="confirmandoAvanco = false"
            >
              Cancelar
            </button>
          </div>
        </template>
      </section>
    </template>
  </main>
</template>

<style scoped>
.topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.25rem;
}

.topo h1 {
  margin: 0;
}

.resumo {
  margin: 0 0 1rem;
  color: var(--texto-suave);
}

.treino {
  margin-bottom: 1.25rem;
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  overflow: hidden;
}

.treino__titulo {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin: 0;
  padding: 0.75rem;
  background: var(--fundo-elevado);
  font-size: 1rem;
}

.treino__id {
  color: var(--acento);
  font-weight: 700;
}

.treino__dia {
  margin-left: auto;
  color: var(--texto-suave);
  font-size: 0.8125rem;
  font-weight: 400;
}

.itens {
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.125rem 0.75rem;
  padding: 0.625rem 0.75rem;
  border-top: 1px solid var(--borda);
}

.item__alvo {
  grid-column: 1 / -1;
  color: var(--texto-suave);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.item__nome {
  font-size: 0.9375rem;
}

.item__ancora {
  color: var(--acento);
  font-size: 0.8125rem;
}

.item__opcional {
  margin-left: 0.375rem;
  padding: 0.0625rem 0.375rem;
  border-radius: 999px;
  background: var(--borda);
  color: var(--texto-suave);
  font-size: 0.6875rem;
}

.item__series {
  color: var(--texto-suave);
  font-size: 0.875rem;
  white-space: nowrap;
}

.volume,
.avisos,
.avancar {
  margin-top: 1.5rem;
  padding: 1rem;
  border: 1px solid var(--borda);
  border-radius: var(--raio);
}

.volume__titulo,
.avisos__titulo,
.avancar__titulo {
  margin: 0 0 0.25rem;
  font-size: 1rem;
}

.volume__nota,
.avancar__nota {
  margin: 0 0 0.75rem;
  color: var(--texto-suave);
  font-size: 0.8125rem;
}

.volume__lista {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.volume__item {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: 0.5rem;
  background: var(--fundo-elevado);
  font-size: 0.875rem;
}

.avisos {
  border-color: color-mix(in srgb, var(--perigo) 40%, var(--borda));
}

.avisos ul {
  margin: 0;
  padding-left: 1.125rem;
  color: var(--texto-suave);
  font-size: 0.875rem;
}

.avancar__erro {
  margin: 0 0 0.75rem;
  color: var(--perigo);
  font-size: 0.875rem;
}

.avancar__confirma {
  margin: 0 0 0.75rem;
  font-size: 0.9375rem;
}

.avancar__acoes {
  display: flex;
  gap: 0.5rem;
}

.botao {
  flex: 1;
  min-height: 2.75rem;
  padding: 0 1rem;
  border: 1px solid transparent;
  border-radius: var(--raio);
  background: var(--acento);
  color: #fff;
  font-weight: 600;
}

.botao--secundario {
  background: none;
  border-color: var(--borda);
  color: var(--texto);
}

.botao:disabled {
  opacity: 0.5;
}
</style>
