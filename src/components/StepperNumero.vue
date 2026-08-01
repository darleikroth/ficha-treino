<script setup lang="ts">
import { computed, nextTick, ref } from "vue";

/**
 * Entrada numérica para uso com uma mão, na academia.
 *
 * Não usa `<input type="number">`: em mobile o teclado é hostil, as setinhas
 * são alvos minúsculos e o campo aceita lixo. Aqui os botões `−`/`+` são o
 * caminho principal, com 44px de alvo; tocar no valor abre edição direta com
 * `inputmode="decimal"`.
 */
const props = withDefaults(
  defineProps<{
    modelValue: number;
    passo?: number;
    minimo?: number;
    maximo?: number;
    rotulo?: string;
    sufixo?: string;
    casas?: number;
  }>(),
  { passo: 1, minimo: 0, maximo: 9999, casas: 0, rotulo: "", sufixo: "" },
);

const emit = defineEmits<{ "update:modelValue": [valor: number] }>();

const editando = ref(false);
const rascunho = ref("");
const campo = ref<HTMLInputElement | null>(null);

const exibido = computed(() => formatar(props.modelValue));

function formatar(valor: number): string {
  const arredondado = Math.round(valor * 100) / 100;
  return (props.casas > 0 ? arredondado.toFixed(props.casas) : String(arredondado)).replace(".", ",");
}

function limitar(valor: number): number {
  const preso = Math.min(props.maximo, Math.max(props.minimo, valor));
  return Math.round(preso * 100) / 100;
}

function ajustar(delta: number): void {
  emit("update:modelValue", limitar(props.modelValue + delta));
}

async function abrirEdicao(): Promise<void> {
  rascunho.value = exibido.value;
  editando.value = true;
  await nextTick();
  campo.value?.select();
}

function confirmarEdicao(): void {
  editando.value = false;
  const numero = Number(rascunho.value.replace(",", "."));
  if (Number.isFinite(numero)) emit("update:modelValue", limitar(numero));
}
</script>

<template>
  <div class="stepper">
    <span v-if="rotulo" class="stepper__rotulo">{{ rotulo }}</span>

    <div class="stepper__controles">
      <button
        class="stepper__botao"
        type="button"
        :aria-label="`Diminuir ${rotulo}`"
        :disabled="modelValue <= minimo"
        @click="ajustar(-passo)"
      >
        −
      </button>

      <button
        v-if="!editando"
        class="stepper__valor"
        type="button"
        :aria-label="`${rotulo}: ${exibido}. Tocar para digitar`"
        @click="abrirEdicao"
      >
        {{ exibido }}<span v-if="sufixo" class="stepper__sufixo">{{ sufixo }}</span>
      </button>

      <input
        v-else
        ref="campo"
        v-model="rascunho"
        class="stepper__campo"
        type="text"
        inputmode="decimal"
        :aria-label="rotulo"
        @blur="confirmarEdicao"
        @keyup.enter="confirmarEdicao"
      />

      <button
        class="stepper__botao"
        type="button"
        :aria-label="`Aumentar ${rotulo}`"
        :disabled="modelValue >= maximo"
        @click="ajustar(passo)"
      >
        +
      </button>
    </div>
  </div>
</template>

<style scoped>
.stepper {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.stepper__rotulo {
  color: var(--texto-suave);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stepper__controles {
  display: grid;
  /* minmax(0, 1fr) no meio: sem o 0, o conteúdo impede o encolhimento e o
     botão da direita é empurrado para fora do card. */
  grid-template-columns: var(--toque-min) minmax(0, 1fr) var(--toque-min);
  align-items: stretch;
  gap: 0.25rem;
}

.stepper__botao {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--toque-min);
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  background: var(--fundo-elevado);
  font-size: 1.375rem;
  line-height: 1;
  /* toque repetido não pode selecionar texto nem dar zoom */
  user-select: none;
  touch-action: manipulation;
}

.stepper__botao:active:not(:disabled) {
  background: var(--acento);
  color: #fff;
}

.stepper__botao:disabled {
  opacity: 0.35;
}

.stepper__valor,
.stepper__campo {
  min-height: var(--toque-min);
  padding: 0 0.25rem;
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  background: var(--fundo);
  color: var(--texto);
  font-size: 1.25rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.stepper__campo {
  width: 100%;
  font-family: inherit;
}

.stepper__sufixo {
  margin-left: 0.125rem;
  color: var(--texto-suave);
  font-size: 0.8125rem;
}
</style>
