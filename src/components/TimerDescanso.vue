<script setup lang="ts">
import { watch } from "vue";

import { useTimer } from "../composables/useTimer.ts";

const props = withDefaults(defineProps<{ segundos?: number }>(), { segundos: 90 });
const emit = defineEmits<{ fim: [] }>();

const timer = useTimer();

defineExpose({ iniciar: (s?: number) => timer.iniciar(s ?? props.segundos), parar: timer.parar });

watch(timer.terminou, (acabou) => {
  if (!acabou) return;
  // Vibração é o sinal que funciona com o celular no bolso e som desligado.
  navigator.vibrate?.([200, 100, 200]);
  emit("fim");
});
</script>

<template>
  <div v-if="timer.rodando.value || timer.terminou.value" class="timer" :class="{ 'timer--fim': timer.terminou.value }">
    <div class="timer__barra">
      <div class="timer__preenchido" :style="{ width: `${timer.fracaoDecorrida.value * 100}%` }" />
    </div>

    <div class="timer__linha">
      <strong class="timer__tempo">{{ timer.terminou.value ? "Descanso concluído" : timer.texto.value }}</strong>

      <div class="timer__acoes">
        <button v-if="timer.rodando.value" class="timer__botao" type="button" @click="timer.somar(30)">
          +30s
        </button>
        <button class="timer__botao" type="button" @click="timer.parar()">
          {{ timer.terminou.value ? "Ok" : "Pular" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timer {
  position: sticky;
  bottom: calc(0.5rem + var(--safe-bottom));
  z-index: 2;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  background: var(--fundo-elevado);
}

.timer--fim {
  border-color: var(--ok);
}

.timer__barra {
  height: 0.25rem;
  margin-bottom: 0.5rem;
  border-radius: 999px;
  background: var(--borda);
  overflow: hidden;
}

.timer__preenchido {
  height: 100%;
  background: var(--acento);
}

.timer--fim .timer__preenchido {
  background: var(--ok);
}

.timer__linha {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.timer__tempo {
  font-size: 1.125rem;
  font-variant-numeric: tabular-nums;
}

.timer__acoes {
  display: flex;
  gap: 0.375rem;
}

.timer__botao {
  min-height: var(--toque-min);
  padding: 0 0.875rem;
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  background: none;
  font-size: 0.875rem;
}
</style>
