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
  margin: 30px auto 44px;
  max-width: 980px;
  padding: 0 6vw;
  width: 100%;
}

.new-recipe-header {
  align-items: center;
  background: #fff7fb;
  border: 1px solid #f6d9ea;
  border-radius: 22px;
  box-shadow: 0 2px 18px rgba(191, 140, 167, 0.12);
  display: flex;
  gap: 18px;
  justify-content: space-between;
  margin-bottom: 22px;
  padding: 24px 22px 20px;
}

.new-recipe-header h1 {
  color: #cc7da9;
  font-size: 2rem;
  margin: 0 0 6px;
}

.new-recipe-header p {
  color: #486b68;
  margin: 0;
}

.required-star {
  color: #cc7da9;
  font-weight: 800;
}

.back-link {
  align-items: center;
  background: #ffffff;
  border: 1px solid #c3e7e1;
  border-radius: 999px;
  color: #486b68;
  display: inline-flex;
  font-weight: 800;
  min-height: 44px;
  padding: 9px 16px;
  text-decoration: none;
  white-space: nowrap;
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
