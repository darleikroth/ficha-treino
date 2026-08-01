<script setup lang="ts">
// Preenchida na Fase 6: execução do treino. É a tela que define se o app é
// usável — celular na mão, entre séries, possivelmente com uma mão só.
defineProps<{ treinoId: string }>();
</script>

<template>
  <main class="pagina">
    <h1>Treino {{ treinoId }}</h1>
    <p class="pendente">Execução — Fase 6.</p>
    <RouterLink :to="{ name: 'home' }">Voltar</RouterLink>
  </main>
</template>
