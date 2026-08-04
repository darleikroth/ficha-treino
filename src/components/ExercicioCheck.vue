<script setup lang="ts">
import type { ItemCiclo } from "../core/gerador.ts";

defineProps<{
  item: ItemCiclo;
  feito: boolean;
}>();

const emit = defineEmits<{ alternar: [] }>();
</script>

<!--
  Linha da checklist do modo simples (DD-A18): o cartão inteiro é um botão e um
  toque alterna feito/não feito. Desfazer é o mesmo gesto — o toque errado é o
  evento mais comum, então nada de confirmação no caminho.
-->
<template>
  <button
    class="check"
    :class="{ 'check--feito': feito }"
    type="button"
    :aria-pressed="feito"
    @click="emit('alternar')"
  >
    <span class="check__marca" aria-hidden="true">{{ feito ? "✓" : "" }}</span>

    <span class="check__identidade">
      <span class="check__alvo">{{ item.slot.alvo }}</span>
      <span class="check__nome">
        {{ item.exercicio?.nome ?? item.exercicioId }}
        <span v-if="item.slot.ancora" class="check__ancora" title="Âncora — não rotaciona">[Â]</span>
      </span>
    </span>

    <span class="check__prescricao">{{ item.slot.series }} × {{ item.slot.reps }}</span>
  </button>
</template>

<style scoped>
.check {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 3.5rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  background: var(--fundo-elevado);
  text-align: left;
}

.check--feito {
  border-color: var(--ok);
  opacity: 0.75;
}

.check__marca {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: 2px solid var(--borda);
  border-radius: 50%;
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
}

.check--feito .check__marca {
  border-color: var(--ok);
  background: var(--ok);
}

.check__identidade {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.check__alvo {
  color: var(--texto-suave);
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.check__nome {
  font-size: 0.9375rem;
  font-weight: 500;
}

.check__ancora {
  color: var(--acento);
  font-size: 0.8125rem;
}

.check__prescricao {
  color: var(--texto-suave);
  font-size: 0.8125rem;
  white-space: nowrap;
}
</style>
