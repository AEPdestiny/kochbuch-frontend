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
  max-width: 1400px;
  margin: 32px auto 48px auto;
  padding: 0 24px;
  box-sizing: border-box;
}

.my-recipes-header {
  align-items: center;
  background: var(--pink-bg, #fdf1f5);
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  display: flex;
  gap: 18px;
  justify-content: space-between;
  padding: 26px 32px;
  margin-bottom: 24px;
}

.page-title {
  font-size: 2rem;
  font-weight: 800;
  color: var(--pink-dark, #d44488);
  margin-bottom: 6px;
}

.page-subtitle {
  font-size: 0.98rem;
  color: var(--text-gray, #6b7478);
}

.my-recipes-content {
  width: 100%;
}

.create-recipe-link {
  align-items: center;
  background: var(--pink, #e85a9b);
  border-radius: var(--radius-pill, 999px);
  color: #ffffff;
  display: inline-flex;
  font-weight: 700;
  min-height: 44px;
  padding: 12px 22px;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.16s ease, transform 0.16s ease;
}

.create-recipe-link:hover {
  background: var(--pink-dark, #d44488);
  transform: translateY(-1px);
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
