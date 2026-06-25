<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiClientError, AUTH_TOKEN_STORAGE_KEY } from '@/shared/api/apiClient'
import { profileApi } from '@/shared/api/profileApi'
import type { UserPreferencesRequest } from '@/types/profile'

const { t } = useI18n()

const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const likesText = ref('')
const dislikesText = ref('')
const allergiesText = ref('')
const vegan = ref(false)
const vegetarian = ref(false)
const glutenFree = ref(false)
const lactoseFree = ref(false)
const highProtein = ref(false)
const calorieConscious = ref(false)
const dailyCalorieTarget = ref<number | null>(null)

onMounted(() => {
  loadPreferences()
})

async function loadPreferences() {
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    error.value = t('profile.errors.loginRequired')
    loading.value = false
    return
  }

  try {
    const preferences = await profileApi.getPreferences()
    likesText.value = formatList(preferences.likes)
    dislikesText.value = formatList(preferences.dislikes)
    allergiesText.value = formatList(preferences.allergies)
    vegan.value = preferences.vegan
    vegetarian.value = preferences.vegetarian
    glutenFree.value = preferences.glutenFree
    lactoseFree.value = preferences.lactoseFree
    highProtein.value = preferences.highProtein
    calorieConscious.value = preferences.calorieConscious
    dailyCalorieTarget.value = preferences.dailyCalorieTarget ?? preferences.calorieGoal ?? null
    error.value = null
  } catch (e: unknown) {
    error.value = toLoadError(e)
  } finally {
    loading.value = false
  }
}

async function savePreferences() {
  if (!sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
    error.value = t('profile.errors.loginRequired')
    return
  }

  const normalizedDailyTarget = normalizeOptionalPositiveNumber(dailyCalorieTarget.value)
  if (normalizedDailyTarget !== null && normalizedDailyTarget < 1) {
    error.value = t('profile.errors.validation')
    return
  }

  saving.value = true
  error.value = null
  success.value = null

  try {
    const saved = await profileApi.updatePreferences(toRequest())
    likesText.value = formatList(saved.likes)
    dislikesText.value = formatList(saved.dislikes)
    allergiesText.value = formatList(saved.allergies)
    dailyCalorieTarget.value = saved.dailyCalorieTarget ?? saved.calorieGoal ?? dailyCalorieTarget.value
    success.value = t('profile.success.saved')
  } catch (e: unknown) {
    error.value = toSaveError(e)
  } finally {
    saving.value = false
  }
}

function toRequest(): UserPreferencesRequest {
  const normalizedDailyTarget = normalizeOptionalPositiveNumber(dailyCalorieTarget.value)
  return {
    likes: parseList(likesText.value),
    dislikes: parseList(dislikesText.value),
    allergies: parseList(allergiesText.value),
    vegan: vegan.value,
    vegetarian: vegetarian.value,
    glutenFree: glutenFree.value,
    lactoseFree: lactoseFree.value,
    highProtein: highProtein.value,
    calorieConscious: calorieConscious.value,
    budgetFriendly: false,
    maxPrepTimeMinutes: null,
    calorieGoal: normalizedDailyTarget,
    dailyCalorieTarget: normalizedDailyTarget,
  }
}

function onVeganChanged() {
  if (vegan.value) {
    vegetarian.value = false
  }
}

function onVegetarianChanged() {
  if (vegetarian.value) {
    vegan.value = false
  }
}

function parseList(value: string) {
  return value
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
}

function formatList(values: string[] | null | undefined) {
  return values?.join(', ') ?? ''
}

function normalizeOptionalPositiveNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toLoadError(e: unknown) {
  if (e instanceof ApiClientError) {
    if (e.status === 401) {
      return t('profile.errors.sessionExpired')
    }
    if (!e.status) {
      return t('profile.errors.network')
    }
  }
  return t('profile.errors.load')
}

function toSaveError(e: unknown) {
  if (e instanceof ApiClientError) {
    if (e.status === 400) {
      return e.message || t('profile.errors.validation')
    }
    if (e.status === 401) {
      return t('profile.errors.sessionExpired')
    }
    if (!e.status) {
      return t('profile.errors.network')
    }
    if (e.message) {
      return e.message
    }
  }
  if (e instanceof Error && e.message) {
    return e.message
  }
  return t('profile.errors.save')
}
</script>

<template>
  <main class="profile-page">
    <section class="profile-header">
      <p class="eyebrow">{{ t('profile.eyebrow') }}</p>
      <h1>{{ t('profile.title') }}</h1>
      <p>{{ t('profile.subtitle') }}</p>
    </section>

    <p v-if="loading" class="status-message">{{ t('profile.loading') }}</p>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <p v-if="success" class="success-message" role="status">{{ success }}</p>

    <form v-if="!loading" class="preferences-form" @submit.prevent="savePreferences">
      <section class="profile-card">
        <div class="section-heading">
          <h2>{{ t('profile.sections.taste.title') }}</h2>
          <p>{{ t('profile.sections.taste.description') }}</p>
        </div>
        <div class="field-grid">
          <label>
            {{ t('profile.form.likes') }}
            <textarea v-model="likesText" :placeholder="t('profile.form.likesPlaceholder')" />
          </label>

          <label>
            {{ t('profile.form.dislikes') }}
            <textarea v-model="dislikesText" :placeholder="t('profile.form.dislikesPlaceholder')" />
          </label>
        </div>
      </section>

      <section class="profile-card profile-card-safety">
        <div class="section-heading">
          <h2>{{ t('profile.sections.safety.title') }}</h2>
          <p>{{ t('profile.sections.safety.description') }}</p>
        </div>
        <label>
          {{ t('profile.form.allergies') }}
          <textarea v-model="allergiesText" :placeholder="t('profile.form.allergiesPlaceholder')" />
        </label>
        <p class="helper-text">{{ t('profile.hints.allergiesAlwaysActive') }}</p>
      </section>

      <section class="profile-card">
        <div class="section-heading">
          <h2>{{ t('profile.sections.diet.title') }}</h2>
          <p>{{ t('profile.sections.diet.description') }}</p>
        </div>
        <fieldset class="option-grid">
          <legend class="sr-only">{{ t('profile.form.dietaryStyles') }}</legend>
          <label><input v-model="vegan" type="checkbox" @change="onVeganChanged" /> {{ t('profile.options.vegan') }}</label>
          <label><input v-model="vegetarian" type="checkbox" @change="onVegetarianChanged" /> {{ t('profile.options.vegetarian') }}</label>
          <label><input v-model="glutenFree" type="checkbox" /> {{ t('profile.options.glutenFree') }}</label>
          <label><input v-model="lactoseFree" type="checkbox" /> {{ t('profile.options.lactoseFree') }}</label>
        </fieldset>
      </section>

      <section class="profile-card">
        <div class="section-heading">
          <h2>{{ t('profile.sections.goals.title') }}</h2>
          <p>{{ t('profile.sections.goals.description') }}</p>
        </div>
        <fieldset class="option-grid">
          <legend class="sr-only">{{ t('profile.form.goals') }}</legend>
          <label><input v-model="highProtein" type="checkbox" /> {{ t('profile.options.highProtein') }}</label>
          <label><input v-model="calorieConscious" type="checkbox" /> {{ t('profile.options.calorieConscious') }}</label>
        </fieldset>

        <label class="calorie-field">
          {{ t('profile.form.calorieGoal') }}
          <input
            v-model.number="dailyCalorieTarget"
            type="number"
            min="1"
            step="1"
            :placeholder="t('profile.form.calorieGoalPlaceholder')"
          />
          <span class="helper-text">{{ t('profile.hints.calorieGoal') }}</span>
        </label>
      </section>

      <aside class="profile-guidance">
        <strong>{{ t('profile.hints.personalizationTitle') }}</strong>
        <p>{{ t('profile.hints.personalization') }}</p>
      </aside>

      <div class="form-actions">
        <button class="save-button" type="submit" :disabled="saving">
          {{ saving ? t('profile.actions.saving') : t('profile.actions.save') }}
        </button>
      </div>
    </form>
  </main>
</template>

<style scoped>
.profile-page {
  max-width: 980px;
  margin: 0 auto;
  padding: 2rem 1rem 3rem;
  color: #243b38;
  width: 100%;
}

.profile-header {
  margin-bottom: 1.5rem;
}

.eyebrow {
  margin: 0 0 0.35rem;
  color: #2f8f7b;
  font-weight: 700;
  text-transform: uppercase;
}

.profile-header h1 {
  margin: 0 0 0.5rem;
  font-size: 2rem;
}

.preferences-form {
  display: grid;
  gap: 1.1rem;
}

.preferences-form label {
  display: grid;
  gap: 0.45rem;
  font-weight: 700;
}

.profile-card {
  border: 1px solid #d7e8e3;
  border-radius: 8px;
  background: #ffffff;
  padding: 1.25rem;
  box-shadow: 0 5px 18px rgba(36, 59, 56, 0.06);
}

.profile-card-safety {
  border-left: 4px solid #d18a5d;
}

.section-heading {
  margin-bottom: 1rem;
}

.section-heading h2 {
  margin: 0 0 0.3rem;
  font-size: 1.2rem;
}

.section-heading p,
.profile-guidance p {
  margin: 0;
  color: #486b68;
  line-height: 1.5;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
  gap: 1rem;
}

.preferences-form textarea,
.preferences-form input[type='number'],
.preferences-form select {
  width: 100%;
  border: 1px solid #c7ded8;
  border-radius: 8px;
  padding: 0.75rem;
  font: inherit;
}

.helper-text {
  color: #486b68;
  font-size: 0.92rem;
  font-weight: 500;
  margin: 0;
}

.preferences-form textarea {
  min-height: 86px;
  resize: vertical;
}

.option-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr));
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  border: 0;
}

.option-grid label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  border: 1px solid #d7e8e3;
  border-radius: 8px;
  padding: 0.7rem 0.8rem;
}

.calorie-field {
  max-width: 420px;
  margin-top: 1rem;
}

.profile-guidance {
  border-radius: 8px;
  background: #eef8f4;
  padding: 1rem 1.1rem;
}

.profile-guidance strong {
  display: block;
  margin-bottom: 0.25rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.save-button {
  border: 0;
  border-radius: 8px;
  background: #2f8f7b;
  color: white;
  padding: 0.75rem 1.15rem;
  font-weight: 700;
  min-height: 44px;
  cursor: pointer;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.save-button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.status-message,
.success-message,
.error-message {
  border-radius: 8px;
  padding: 0.8rem 1rem;
}

.status-message {
  background: #eef8f4;
}

.success-message {
  background: #e5f8ed;
  color: #23633f;
}

.error-message {
  background: #fff1f1;
  color: #9b2226;
}

@media (max-width: 640px) {
  .profile-page {
    padding: 1.25rem 0.75rem 2rem;
  }

  .profile-header h1 {
    font-size: 1.55rem;
    line-height: 1.2;
  }

  .profile-card {
    padding: 1rem;
  }

  .option-grid label {
    min-height: 44px;
  }

  .form-actions {
    justify-content: stretch;
  }

  .save-button {
    width: 100%;
  }
}
</style>
