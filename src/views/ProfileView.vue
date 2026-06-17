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
const dailyCalorieTarget = ref<number | null>(2200)

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
    dailyCalorieTarget.value = preferences.dailyCalorieTarget ?? preferences.calorieGoal ?? 2200
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
      <label>
        {{ t('profile.form.likes') }}
        <textarea v-model="likesText" :placeholder="t('profile.form.likesPlaceholder')" />
      </label>

      <label>
        {{ t('profile.form.dislikes') }}
        <textarea v-model="dislikesText" :placeholder="t('profile.form.dislikesPlaceholder')" />
      </label>

      <label>
        {{ t('profile.form.allergies') }}
        <textarea v-model="allergiesText" :placeholder="t('profile.form.allergiesPlaceholder')" />
      </label>

      <fieldset>
        <legend>{{ t('profile.form.dietaryStyles') }}</legend>
        <label><input v-model="vegan" type="checkbox" @change="onVeganChanged" /> {{ t('profile.options.vegan') }}</label>
        <label><input v-model="vegetarian" type="checkbox" @change="onVegetarianChanged" /> {{ t('profile.options.vegetarian') }}</label>
        <label><input v-model="glutenFree" type="checkbox" /> {{ t('profile.options.glutenFree') }}</label>
        <label><input v-model="lactoseFree" type="checkbox" /> {{ t('profile.options.lactoseFree') }}</label>
      </fieldset>

      <fieldset>
        <legend>{{ t('profile.form.goals') }}</legend>
        <label><input v-model="highProtein" type="checkbox" /> {{ t('profile.options.highProtein') }}</label>
        <label><input v-model="calorieConscious" type="checkbox" /> kalorienarm</label>
      </fieldset>

      <label>
        Tagesziel Kalorien
        <input v-model.number="dailyCalorieTarget" type="number" min="1" step="1" placeholder="z. B. 2200" />
      </label>

      <button class="save-button" type="submit" :disabled="saving">
        {{ saving ? t('profile.actions.saving') : t('profile.actions.save') }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.profile-page {
  max-width: 980px;
  margin: 0 auto;
  padding: 2rem 1rem 3rem;
  color: #243b38;
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
  gap: 1rem;
}

.preferences-form label,
.preferences-form fieldset {
  display: grid;
  gap: 0.45rem;
  font-weight: 700;
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

.preferences-form fieldset {
  border: 1px solid #d7e8e3;
  border-radius: 8px;
  padding: 1rem;
}

.preferences-form fieldset label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}

.number-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.save-button {
  justify-self: start;
  border: 0;
  border-radius: 8px;
  background: #2f8f7b;
  color: white;
  padding: 0.75rem 1.15rem;
  font-weight: 700;
  cursor: pointer;
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
</style>
