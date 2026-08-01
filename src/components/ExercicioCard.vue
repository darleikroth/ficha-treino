<script setup lang="ts">
import { computed } from "vue";

import type { ItemCiclo } from "../core/gerador.ts";
import { seriesAlvo } from "../core/progressao.ts";
import type { Serie } from "../db/esquema.ts";
import type { Sugestao } from "../core/progressao.ts";
import SerieInput from "./SerieInput.vue";

const props = withDefaults(
  defineProps<{
    item: ItemCiclo;
    series: Serie[];
    sugestao: Sugestao;
    incremento?: number;
    unidade?: string;
    rir?: string;
    expandido?: boolean;
    salvando?: boolean;
  }>(),
  { incremento: 2.5, unidade: "kg", rir: "", expandido: false, salvando: false },
);

const emit = defineEmits<{
  alternar: [];
  registrar: [dados: { peso: number; reps: number; rir: number | null }];
  desfazer: [indice: number];
}>();

const alvo = computed(() => seriesAlvo(props.item.slot.series));
const feitas = computed(() => props.series.length);
const completo = computed(() => feitas.value >= alvo.value);

const repsSugeridas = computed(() => {
  const faixa = /(\d+)/.exec(props.item.slot.reps);
  return faixa ? Number(faixa[1]) : 10;
});

const resumoCarga = computed(() => {
  if (!props.series.length) return null;
  const ultima = props.series[props.series.length - 1];
  return `${formatar(ultima.peso)} ${props.unidade} × ${ultima.reps}`;
});

const formatar = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
</script>

<template>
  <article class="card" :class="{ 'card--completo': completo, 'card--aberto': expandido }">
    <button class="card__cabecalho" type="button" :aria-expanded="expandido" @click="emit('alternar')">
      <div class="card__identidade">
        <span class="card__alvo">{{ item.slot.alvo }}</span>
        <span class="card__nome">
          {{ item.exercicio?.nome ?? item.exercicioId }}
          <span v-if="item.slot.ancora" class="card__ancora" title="Âncora — não rotaciona">[Â]</span>
        </span>
      </div>

      <div class="card__estado">
        <span class="card__contagem">{{ feitas }}/{{ alvo }}</span>
        <span v-if="resumoCarga" class="card__carga">{{ resumoCarga }}</span>
      </div>
    </button>

    <div v-if="expandido" class="card__corpo">
      <p class="card__prescricao">
        <strong>{{ item.slot.series }} × {{ item.slot.reps }}</strong>
        <span v-if="rir" class="card__rir">· {{ rir }}</span>
      </p>

      <ol v-if="series.length" class="registradas">
        <li v-for="(serie, indice) in series" :key="indice" class="registradas__item">
          <span class="registradas__numero">{{ indice + 1 }}ª</span>
          <span class="registradas__valor">
            {{ formatar(serie.peso) }} {{ unidade }} × {{ serie.reps }}
            <span v-if="serie.rir !== null" class="registradas__rir">RIR {{ serie.rir }}</span>
          </span>
          <button
            class="registradas__desfazer"
            type="button"
            :aria-label="`Desfazer ${indice + 1}ª série`"
            @click="emit('desfazer', indice)"
          >
            Desfazer
          </button>
        </li>
      </ol>

      <SerieInput
        v-if="!completo"
        :peso-sugerido="sugestao.peso"
        :reps-sugeridas="repsSugeridas"
        :incremento="incremento"
        :unidade="unidade"
        :numero-da-serie="feitas + 1"
        :motivo="feitas === 0 ? sugestao.motivo : ''"
        :salvando="salvando"
        @registrar="emit('registrar', $event)"
      />

      <p v-else class="card__pronto">Exercício concluído.</p>
    </div>
  </article>
</template>

<style scoped>
.card {
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  background: var(--fundo-elevado);
  overflow: hidden;
}

.card--aberto {
  border-color: var(--acento);
}

.card--completo:not(.card--aberto) {
  opacity: 0.7;
}

.card__cabecalho {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem;
  border: none;
  background: none;
  text-align: left;
}

.card__identidade {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.card__alvo {
  color: var(--texto-suave);
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.card__nome {
  font-size: 0.9375rem;
  font-weight: 500;
}

.card__ancora {
  color: var(--acento);
  font-size: 0.8125rem;
}

.card__estado {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.125rem;
  white-space: nowrap;
}

.card__contagem {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.card--completo .card__contagem {
  color: var(--ok);
}

.card__carga {
  color: var(--texto-suave);
  font-size: 0.75rem;
}

.card__corpo {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 0 0.75rem 0.75rem;
}

.card__prescricao {
  margin: 0;
  font-size: 0.9375rem;
}

.card__rir {
  color: var(--texto-suave);
}

.registradas {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.registradas__item {
  display: grid;
  grid-template-columns: 2rem 1fr auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  background: var(--fundo);
}

.registradas__numero {
  color: var(--texto-suave);
  font-size: 0.8125rem;
}

.registradas__valor {
  font-variant-numeric: tabular-nums;
  font-size: 0.9375rem;
}

.registradas__rir {
  margin-left: 0.375rem;
  color: var(--texto-suave);
  font-size: 0.75rem;
}

/* Desfazer sempre acessível: erro de digitação é o evento mais comum. */
.registradas__desfazer {
  min-height: var(--toque-min);
  padding: 0 0.625rem;
  border: none;
  background: none;
  color: var(--texto-suave);
  font-size: 0.8125rem;
  text-decoration: underline;
}

.card__pronto {
  margin: 0;
  color: var(--ok);
  font-size: 0.875rem;
}
</style>
