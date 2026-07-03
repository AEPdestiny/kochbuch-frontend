<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import RecipeList from '@/components/RecipeList.vue'

const { t } = useI18n()
</script>

<template>
  <section class="new-recipe-page">
    <header class="new-recipe-header">
      <div>
        <h1>{{ t('recipes.my.createTitle') }}</h1>
        <p>
          {{ t('recipes.my.requiredHintStart') }}
          <span class="required-star">*</span>
          {{ t('recipes.my.requiredHintEnd') }}
        </p>
      </div>
      <RouterLink to="/my-recipes" class="back-link">
        {{ t('recipes.actions.backToMyRecipes') }}
      </RouterLink>
    </header>

    <RecipeList mode="create" />
  </section>
</template>

<style scoped>
.new-recipe-page {
  box-sizing: border-box;
  margin: 32px auto 48px;
  max-width: 1200px;
  padding: 0 24px;
  width: 100%;
}

.new-recipe-header {
  align-items: center;
  background: var(--pink-bg, #fdf1f5);
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  display: flex;
  gap: 18px;
  justify-content: space-between;
  margin-bottom: 24px;
  padding: 26px 32px;
}

.new-recipe-header h1 {
  color: var(--pink-dark, #d44488);
  font-size: 2rem;
  margin: 0 0 6px;
}

.new-recipe-header p {
  color: var(--text-gray, #6b7478);
  margin: 0;
}

.required-star {
  color: var(--pink, #e85a9b);
  font-weight: 700;
}

.back-link {
  align-items: center;
  background: #ffffff;
  border: 1.5px solid var(--line, #e6ecea);
  border-radius: var(--radius-pill, 999px);
  color: var(--text-gray, #6b7478);
  display: inline-flex;
  font-weight: 700;
  min-height: 44px;
  padding: 9px 18px;
  text-decoration: none;
  white-space: nowrap;
  transition: border-color 0.16s ease, color 0.16s ease;
}

.back-link:hover {
  border-color: var(--mint, #5ecbb5);
  color: var(--mint-darker, #2b8c7b);
}

@media (max-width: 640px) {
  .new-recipe-page {
    margin: 18px auto 32px;
    padding: 0 12px;
  }

  .new-recipe-header {
    align-items: stretch;
    border-radius: 16px;
    flex-direction: column;
    padding: 20px 16px 18px;
  }

  .new-recipe-header h1 {
    font-size: 1.55rem;
    line-height: 1.2;
  }

  .back-link {
    justify-content: center;
    width: 100%;
  }
}
</style>
