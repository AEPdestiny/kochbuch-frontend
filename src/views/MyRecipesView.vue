<script setup lang="ts">
import RecipeList from '../components/RecipeList.vue'
</script>

<template>
  <section class="my-recipes">
    <h2>Deine Rezepte verwalten</h2>
    <RecipeList />
  </section>
</template>

<style scoped>
.my-recipes {
  width: 100vw;
  max-width: 100vw;
  padding: 30px 10vw 40px 10vw;
}
h2 {
  font-size: 2rem;
  font-weight: 800;
  color: #198a49;
  margin-bottom: 20px;
}
</style>
