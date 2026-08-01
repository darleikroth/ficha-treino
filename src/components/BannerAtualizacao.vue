<script setup lang="ts">
import { useAtualizacao } from "../composables/useAtualizacao.ts";

const atualizacao = useAtualizacao();
</script>

<template>
  <!--
    Fica no topo, não no rodapé: embaixo moram o timer de descanso e o botão de
    registrar série, e um banner ali seria tocado por engano entre séries.
  -->
  <div v-if="atualizacao.temAtualizacao.value" class="banner" role="status">
    <div class="banner__texto">
      <strong>Nova versão disponível</strong>
      <span>Atualizar recarrega o app. O treino em andamento não se perde.</span>
    </div>

    <div class="banner__acoes">
      <button
        class="banner__depois"
        type="button"
        :disabled="atualizacao.aplicando.value"
        @click="atualizacao.dispensar()"
      >
        Depois
      </button>
      <button
        class="banner__atualizar"
        type="button"
        :disabled="atualizacao.aplicando.value"
        @click="atualizacao.atualizar()"
      >
        {{ atualizacao.aplicando.value ? "Atualizando…" : "Atualizar" }}
      </button>
    </div>

    <p v-if="atualizacao.erro.value" class="banner__erro" role="alert">
      {{ atualizacao.erro.value }}
    </p>
  </div>
</template>

<style scoped>
.banner {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.625rem 0.75rem;
  padding-top: calc(0.625rem + var(--safe-top));
  border-bottom: 1px solid var(--acento);
  background: color-mix(in srgb, var(--acento) 18%, var(--fundo-elevado));
}

.banner__texto {
  display: flex;
  flex: 1 1 12rem;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  font-size: 0.8125rem;
}

.banner__texto span {
  color: var(--texto-suave);
}

.banner__acoes {
  display: flex;
  gap: 0.5rem;
}

.banner__depois,
.banner__atualizar {
  min-height: var(--toque-min);
  padding: 0 1rem;
  border: 1px solid transparent;
  border-radius: var(--raio);
  font-size: 0.9375rem;
  font-weight: 600;
  touch-action: manipulation;
}

.banner__depois {
  border-color: var(--borda);
  background: none;
  color: var(--texto-suave);
  font-weight: 500;
}

.banner__atualizar {
  background: var(--acento);
  color: #fff;
}

.banner__depois:disabled,
.banner__atualizar:disabled {
  opacity: 0.6;
}

.banner__erro {
  flex-basis: 100%;
  margin: 0;
  color: var(--perigo);
  font-size: 0.75rem;
}
</style>
