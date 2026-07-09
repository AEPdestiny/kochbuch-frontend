import { createI18n } from 'vue-i18n'
import de from './locales/de.json'
import en from './locales/en.json'

export const LOCALE_STORAGE_KEY = 'dishly.locale'
export const supportedLocales = ['de', 'en'] as const
export type LocaleCode = (typeof supportedLocales)[number]

const messages = {
  de,
  en,
}

export const i18n = createI18n({
  legacy: false,
  locale: resolveInitialLocale(),
  fallbackLocale: 'de',
  messages,
})

applyDocumentLocale(i18n.global.locale.value as LocaleCode)

export function setLocale(locale: string) {
  const normalizedLocale = normalizeLocale(locale)
  i18n.global.locale.value = normalizedLocale
  localStorage.setItem(LOCALE_STORAGE_KEY, normalizedLocale)
  applyDocumentLocale(normalizedLocale)
}

export function normalizeLocale(locale: string | null | undefined): LocaleCode {
  const baseLocale = locale?.toLowerCase().split('-')[0]
  return supportedLocales.includes(baseLocale as LocaleCode)
    ? (baseLocale as LocaleCode)
    : 'de'
}

function resolveInitialLocale() {
  const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY)
  if (storedLocale) {
    return normalizeLocale(storedLocale)
  }

  return normalizeLocale(navigator.language)
}

function applyDocumentLocale(locale: LocaleCode) {
  document.documentElement.lang = locale
  document.documentElement.dir = 'ltr'
}
