<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import RecipeList from '../components/RecipeList.vue'

const { t } = useI18n()
</script>

<template>
  <section class="my-recipes-page">
    <header class="my-recipes-header">
      <h2 class="page-title">{{ t('recipes.my.pageTitle') }}</h2>
      <p class="page-subtitle">
        {{ t('recipes.my.pageSubtitle') }}
      </p>
    </header>

    <div class="my-recipes-content">
      <RecipeList />
    </div>
  </section>
</template>

<style scoped>
.my-recipes-page {
  width: 100%;
  max-width: 1100px;
  margin: 30px auto 40px auto;
  padding: 0 10vw;
}

.my-recipes-header {
  background: #fff7fb;
  border-radius: 22px;
  border: 1px solid #f6d9ea;
  box-shadow: 0 2px 18px rgba(191, 140, 167, 0.12);
  padding: 24px 22px 20px 22px;
  margin-bottom: 22px;
}

.page-title {
  font-size: 2rem;
  font-weight: 900;
  color: #cc7da9;
  margin-bottom: 6px;
}

.page-subtitle {
  font-size: 0.98rem;
  color: #486b68;
}

.my-recipes-content {
  width: 100%;
}
</style>
