<script setup lang="ts">
import { ref, watch } from "vue";

import StepperNumero from "./StepperNumero.vue";

const props = withDefaults(
  defineProps<{
    pesoSugerido: number;
    repsSugeridas: number;
    incremento?: number;
    unidade?: string;
    numeroDaSerie: number;
    motivo?: string;
    salvando?: boolean;
  }>(),
  { incremento: 2.5, unidade: "kg", motivo: "", salvando: false },
);

const emit = defineEmits<{ registrar: [dados: { peso: number; reps: number; rir: number | null }] }>();

const peso = ref(props.pesoSugerido);
const reps = ref(props.repsSugeridas);
const rir = ref<number>(2);

// A sugestão muda quando a série anterior é registrada; só reaproveita o valor
// enquanto o usuário não tiver mexido nele.
const tocado = ref(false);
watch(
  () => [props.pesoSugerido, props.repsSugeridas] as const,
  ([novoPeso, novasReps]) => {
    if (tocado.value) return;
    peso.value = novoPeso;
    reps.value = novasReps;
  },
);

function registrar(): void {
  emit("registrar", { peso: peso.value, reps: reps.value, rir: rir.value });
  tocado.value = false;
}
</script>

<template>
  <div class="serie">
    <p v-if="motivo" class="serie__motivo">{{ motivo }}</p>

    <div class="serie__campos">
      <StepperNumero
        v-model="peso"
        :passo="incremento"
        :maximo="999"
        :casas="peso % 1 === 0 ? 0 : 1"
        rotulo="Peso"
        :sufixo="unidade"
        @update:model-value="tocado = true"
      />
      <StepperNumero
        v-model="reps"
        :passo="1"
        :minimo="0"
        :maximo="199"
        rotulo="Reps"
        @update:model-value="tocado = true"
      />
      <StepperNumero v-model="rir" :passo="1" :minimo="0" :maximo="10" rotulo="RIR" />
    </div>

    <button class="serie__registrar" type="button" :disabled="salvando" @click="registrar">
      Registrar {{ numeroDaSerie }}ª série
    </button>
  </div>
</template>

<style scoped>
.serie {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding-top: 0.625rem;
  border-top: 1px dashed var(--borda);
}

.serie__motivo {
  margin: 0;
  color: var(--acento);
  font-size: 0.8125rem;
}

/*
  Duas linhas, não três colunas.
  Cada stepper tem dois alvos de 44px mais o valor legível no meio: ~118px de
  mínimo. Três lado a lado passam de 350px e estouram a largura do card num
  telefone de 390px — o "+" do RIR ficava cortado fora da tela. Diminuir os
  botões não é opção: 44px é o alvo mínimo de toque.

  Peso ocupa a linha inteira por ser o campo mais mexido; reps e RIR dividem a
  de baixo.
*/
.serie__campos {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.serie__campos > :first-child {
  grid-column: 1 / -1;
}

/* Alvo generoso: é o botão apertado com a mão suada, entre séries. */
.serie__registrar {
  min-height: 3rem;
  border: none;
  border-radius: var(--raio);
  background: var(--acento);
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  touch-action: manipulation;
}

.serie__registrar:disabled {
  opacity: 0.6;
}
</style>
