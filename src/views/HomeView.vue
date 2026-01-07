<script setup lang="ts">
import ApiRecipeList from '../components/ApiRecipeList.vue' // bindet die ApiRecipeList-Komponente ein,
</script>

<template>
  <section class="home-page">
    <!-- Haupt-Listenkomponente mit Suche, Shuffle und Overlay -->
    <ApiRecipeList />
  </section>
</template>

<style scoped>
/* volle Breite */
.home-page {
  width: 100%;
}
</style>
