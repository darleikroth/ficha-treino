<script setup lang="ts">
import { computed } from "vue";

import { useSyncStore } from "../stores/sync.ts";

const sync = useSyncStore();

const estado = computed(() => {
  if (sync.travadas.length) return { classe: "travado", texto: `${sync.travadas.length} travada(s)` };
  if (!sync.online) return { classe: "offline", texto: "Offline" };
  if (sync.pendentes > 0) return { classe: "enviando", texto: `Enviando ${sync.pendentes}` };
  return { classe: "ok", texto: "Sincronizado" };
});
</script>

<template>
  <div class="sync" :class="`sync--${estado.classe}`">
    <span class="sync__ponto" aria-hidden="true"></span>
    <span>{{ estado.texto }}</span>
    <button v-if="sync.travadas.length" class="sync__acao" type="button" @click="sync.destravar()">
      Tentar de novo
    </button>
  </div>
</template>

<style scoped>
.sync {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--texto-suave);
}

.sync__ponto {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: currentColor;
}

.sync--ok .sync__ponto {
  background: var(--ok);
}
.sync--enviando .sync__ponto {
  background: var(--acento);
}
.sync--offline .sync__ponto {
  background: var(--texto-suave);
}
.sync--travado {
  color: var(--perigo);
}

.sync__acao {
  min-height: 0;
  padding: 0.25rem 0.5rem;
  border: 1px solid currentColor;
  border-radius: 999px;
  background: none;
  font-size: 0.75rem;
}
</style>
