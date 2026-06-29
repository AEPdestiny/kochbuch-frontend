<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocale, supportedLocales, type LocaleCode } from '@/i18n'
import { useToastStore } from '@/stores/toastStore'

const { locale, t } = useI18n()
const toastStore = useToastStore()

const languageOptions: Array<{ code: LocaleCode; label: string }> = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'pl', label: 'Polski' },
  { code: 'ar', label: 'العربية' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
]

const selectedLocale = computed({
  get: () => locale.value as LocaleCode,
  set: value => {
    if (supportedLocales.includes(value) && value !== locale.value) {
      setLocale(value)
      // t() now uses the new locale, so the message is in the target language.
      toastStore.addToast(t('notifications.languageChanged'), 'info')
    }
  },
})
</script>

<template>
  <label class="language-switcher">
    <span>{{ t('language.label') }}</span>
    <select v-model="selectedLocale" :aria-label="t('language.label')">
      <option
        v-for="option in languageOptions"
        :key="option.code"
        :value="option.code"
      >
        {{ option.label }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.language-switcher {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  color: #486b68;
  font-weight: 600;
  font-size: 0.92rem;
  border-right: 1px solid #ddeeee;
  min-height: 44px;
}

.language-switcher select {
  min-height: 30px;
  border: 1px solid #c3e7e1;
  border-radius: 999px;
  background: #ffffff;
  color: #2b1b23;
  padding: 4px 8px;
  font: inherit;
}

@media (max-width: 640px) {
  .language-switcher {
    border-right: none;
    flex: 1 1 100%;
    justify-content: center;
    padding: 8px 10px;
  }
}
</style>
