<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import RecipeList from '../components/RecipeList.vue'

const { t } = useI18n()
</script>

<template>
  <section class="my-recipes-page">
    <header class="my-recipes-header">
      <div>
        <h2 class="page-title">{{ t('recipes.my.pageTitle') }}</h2>
        <p class="page-subtitle">
          {{ t('recipes.my.pageSubtitle') }}
        </p>
      </div>
      <RouterLink to="/recipes/new" class="create-recipe-link">
        + {{ t('recipes.my.createTitle') }}
      </RouterLink>
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
  box-sizing: border-box;
}

.my-recipes-header {
  align-items: center;
  background: #fff7fb;
  border-radius: 22px;
  border: 1px solid #f6d9ea;
  box-shadow: 0 2px 18px rgba(191, 140, 167, 0.12);
  display: flex;
  gap: 18px;
  justify-content: space-between;
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

.create-recipe-link {
  align-items: center;
  background: #cc7da9;
  border-radius: 999px;
  color: #ffffff;
  display: inline-flex;
  font-weight: 800;
  min-height: 44px;
  padding: 9px 18px;
  text-decoration: none;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .my-recipes-page {
    margin: 18px auto 32px;
    padding: 0 12px;
  }

  .my-recipes-header {
    align-items: stretch;
    border-radius: 16px;
    flex-direction: column;
    padding: 20px 16px 18px;
  }

  .create-recipe-link {
    justify-content: center;
    width: 100%;
  }

  .page-title {
    font-size: 1.55rem;
    line-height: 1.2;
  }
}
</style>
