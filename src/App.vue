<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Wand } from 'reicon-vue'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { useSearchStore } from '@/stores/searchStore'
import router from '@/router'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import AiChatPanel from '@/components/AiChatPanel.vue'
import AppToast from '@/components/AppToast.vue'
import dishlyLogo from '@/assets/dishly-logo.png'

const authStore = useAuthStore()
const toastStore = useToastStore()
const searchStore = useSearchStore()
const { t } = useI18n()
const aiDrawerOpen = ref(false)

onMounted(async () => {
  authStore.initFromStorage()
  if (authStore.token) {
    await authStore.loadCurrentUser()
  }
})

async function logout() {
  authStore.logout()
  searchStore.resetAll()
  aiDrawerOpen.value = false
  toastStore.addToast(t('notifications.logoutSuccess'), 'info')
  await router.push('/')
}
</script>

<template>
  <div class="app-bg">
    <!-- Farbige Linie ganz oben zur visuellen Trennung -->
    <div class="top-line"></div>

    <!-- Oberer Bereich mit Logo, Tagline und Navigation -->
    <header class="main-header">
      <!-- Zeile mit Logo links, Tagline mittig und Nutzerbereich rechts -->
      <div class="header-row">
        <!-- Klickbares Logo führt immer zur Home-Seite -->
        <RouterLink to="/" class="logo-link">
          <img :src="dishlyLogo" alt="Dishly logo" class="logo" />
        </RouterLink>

        <!-- Box mit Slogan in der Mitte -->
        <div class="tagline-box">
          <span class="tagline-deco">✦</span>
          <span class="tagline-text">
            {{ t('app.tagline') }}
          </span>
          <span class="tagline-deco">✦</span>
        </div>

        <!-- Sprache, Nutzer-Chip und Abmelden rechts im Header -->
        <div class="header-right">
          <LanguageSwitcher />
          <!-- Gruppiert, damit Avatar+Logout auf Mobile immer zusammen in einer
               eigenen Zeile bleiben, statt unabhängig voneinander umzubrechen. -->
          <div class="header-account">
            <div v-if="authStore.isAuthenticated" class="user-chip">
              <span class="user-avatar">{{
                (authStore.user?.username ?? t('app.userFallback')).charAt(0).toUpperCase()
              }}</span>
              <span class="user-chip-name">{{ authStore.user?.username ?? t('app.userFallback') }}</span>
            </div>
            <button
              v-if="authStore.isAuthenticated"
              type="button"
              class="nav-button logout-link"
              @click="logout"
            >
              {{ t('navigation.logout') }}
            </button>
            <template v-else>
              <RouterLink to="/login" class="header-auth-link">{{ t('navigation.login') }}</RouterLink>
              <RouterLink to="/register" class="header-auth-link">{{ t('navigation.register') }}</RouterLink>
            </template>
          </div>
        </div>
      </div>

      <!-- Hauptnavigation zwischen den Seiten der App -->
      <nav class="nav-bar">
        <RouterLink to="/" class="nav-item">{{ t('navigation.home') }}</RouterLink>
        <RouterLink v-if="authStore.isAuthenticated" to="/dashboard" class="nav-item">{{ t('navigation.dashboard') }}</RouterLink>
        <RouterLink v-if="authStore.isAuthenticated" to="/profile" class="nav-item">{{ t('navigation.profile') }}</RouterLink>
        <RouterLink v-if="authStore.isAuthenticated" to="/my-recipes" class="nav-item">{{ t('navigation.myRecipes') }}</RouterLink>
        <RouterLink v-if="authStore.isAuthenticated" to="/pantry" class="nav-item">{{ t('navigation.pantry') }}</RouterLink>
        <RouterLink v-if="authStore.isAuthenticated" to="/shopping-list" class="nav-item">{{ t('navigation.shoppingList') }}</RouterLink>
        <RouterLink v-if="authStore.isAuthenticated" to="/meal-plan" class="nav-item">{{ t('navigation.mealPlan') }}</RouterLink>
        <RouterLink to="/about" class="nav-item">{{ t('navigation.about') }}</RouterLink>
        <RouterLink to="/contact" class="nav-item">{{ t('navigation.contact') }}</RouterLink>
      </nav>
    </header>

    <main class="main-main">
      <RouterView />
    </main>

    <footer class="main-footer">
      {{ t('app.footer', { year: 2026 }) }}
    </footer>

    <AppToast />

    <button
      v-if="authStore.isAuthenticated && !aiDrawerOpen"
      type="button"
      class="chat-fab"
      @click="aiDrawerOpen = true"
    >
      <span class="chat-fab-mark" aria-hidden="true">
        <Wand class="ai-wand-icon" :size="20" weight="Filled" />
      </span>
      <span>Dishly AI</span>
    </button>

    <div
      v-if="authStore.isAuthenticated"
      v-show="aiDrawerOpen"
      class="ai-drawer-backdrop"
      @click.self="aiDrawerOpen = false"
    >
      <aside class="ai-drawer" aria-label="Dishly AI Chat">
        <div class="ai-drawer-header">
          <div class="ai-drawer-heading">
            <span class="ai-drawer-icon" aria-hidden="true">
              <Wand class="ai-wand-icon" :size="22" weight="Filled" />
            </span>
            <div>
              <p>Dishly AI</p>
              <h2>{{ t('ai.drawerTitle') }}</h2>
              <span class="ai-drawer-subtitle">Dein smarter Koch-Assistent</span>
            </div>
          </div>
          <button type="button" class="drawer-close" :aria-label="t('ai.close')" @click="aiDrawerOpen = false">✕</button>
        </div>
        <AiChatPanel />
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* Google-Fonts für die gesamte App einbinden: Roboto für Fließtext, Pacifico fürs Logo */
@import url('https://fonts.googleapis.com/css2?family=Pacifico&family=Roboto:wght@400;700&display=swap');

/* Layout, damit Footer unten bleibt */
.app-bg {
  min-height: 100vh;
  width: 100%;
  background: var(--page-bg, #fafcfb);
  font-family: 'Roboto', Arial, sans-serif;
  color: #2b1b23;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}

/* Schmaler Farbverlaufsstreifen mint -> pink ganz oben */
.top-line {
  height: 5px;
  width: 100%;
  background: linear-gradient(90deg, var(--mint, #5ecbb5), var(--pink, #e85a9b));
  flex-shrink: 0;
}

.main-header {
  background: var(--card-bg, #ffffff);
  border-bottom: 1px solid var(--line, #e6ecea);
  padding: 12px clamp(14px, 8vw, 120px) 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: sticky;
  top: 0;
  z-index: 80;
}

/* Zeile mit Logo, Tagline und Nutzerbereich nebeneinander */
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

/* zentriertes Logo */
.logo-link {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  text-decoration: none;
}

/* Wiederhergestelltes Bild-Logo, groß genug um sichtbar zu sein, aber weiterhin
   header-sicher über die responsiven Breakpoints unten skaliert. */
.logo {
  height: 70px;
  width: auto;
  display: block;
}

.tagline-box {
  flex: 1;
  padding: 11px 28px;
  border-radius: var(--radius-pill, 999px);
  background: var(--mint-bg, #ecfaf6);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  max-width: 540px;
  margin: 0 24px;
}

.tagline-text {
  color: var(--pink-dark, #d44488);
  font-weight: 500;
  font-size: 0.95rem;
  text-align: center;
}

.tagline-deco {
  color: var(--mint-dark, #3dae9b);
  font-size: 0.95rem;
}

/* Sprache, Nutzer-Chip und Abmelden/Login rechts im Header */
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

/* Hält Avatar-Chip + Logout (bzw. Login/Register) als eine Einheit zusammen,
   damit sie auf Mobile immer gemeinsam in einer eigenen Zeile umbrechen. */
.header-account {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--mint-bg, #ecfaf6);
  padding: 6px 14px 6px 6px;
  border-radius: var(--radius-pill, 999px);
}

.user-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--mint, #5ecbb5);
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-chip-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--mint-darker, #2b8c7b);
  white-space: nowrap;
}

.logout-link,
.header-auth-link {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-gray, #6b7478);
  text-decoration: none;
  cursor: pointer;
  background: none;
  border: none;
  font-family: inherit;
  white-space: nowrap;
}

.logout-link:hover,
.header-auth-link:hover {
  color: var(--pink, #e85a9b);
}

.nav-bar {
  margin-top: 8px;
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 4px;
  overflow-x: auto;
  padding: 6px 0;
  border-top: 1px solid var(--line, #e6ecea);
  scrollbar-width: none;
}

.nav-bar::-webkit-scrollbar {
  display: none;
}

.nav-item {
  align-items: center;
  display: inline-flex;
  justify-content: center;
  min-height: 40px;
  padding: 10px 18px;
  text-decoration: none;
  color: var(--text-gray, #6b7478);
  font-weight: 500;
  font-size: 13.5px;
  border-radius: var(--radius-pill, 999px);
  text-align: center;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.16s ease, color 0.16s ease;
}

.nav-item:hover {
  background: var(--mint-bg, #ecfaf6);
  color: var(--mint-darker, #2b8c7b);
}

.nav-item.router-link-exact-active {
  background: var(--mint, #5ecbb5);
  color: #ffffff;
}

.nav-item.router-link-exact-active:hover {
  background: var(--mint, #5ecbb5);
  color: #ffffff;
}

.main-main {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 100%;
  max-width: 1500px;
  margin: 0 auto;
  min-width: 0;
  min-height: 80vh;
  background: #ffffff;
}

.main-footer {
  text-align: center;
  color: var(--text-gray, #6b7478);
  background: var(--mint-bg, #ecfaf6);
  font-size: 0.98rem;
  padding: 12px 0 10px 0;
  border-top: 1px solid var(--line, #e6ecea);
}

.chat-fab {
  align-items: center;
  display: inline-flex;
  gap: 9px;
  position: fixed;
  right: 28px;
  bottom: 28px;
  z-index: 200;
  border: none;
  border-radius: 999px;
  background: var(--pink, #e85a9b);
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-weight: 900;
  font-size: 13.5px;
  padding: 10px 16px 10px 10px;
  box-shadow: 0 12px 30px rgba(232, 90, 155, 0.34);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.chat-fab-mark {
  align-items: center;
  background: rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  display: inline-flex;
  height: 30px;
  justify-content: center;
  line-height: 0;
  width: 30px;
}

.ai-wand-icon {
  color: currentColor;
  display: block;
  flex-shrink: 0;
}

.chat-fab:hover {
  box-shadow: 0 16px 36px rgba(232, 90, 155, 0.42);
  transform: translateY(-2px);
}

.ai-drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 210;
  background: transparent;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 24px;
  pointer-events: auto;
}

.ai-drawer {
  background: var(--card-bg, #ffffff);
  border: 1px solid rgba(94, 203, 181, 0.24);
  box-shadow: 0 22px 54px rgba(65, 30, 50, 0.2);
  border-radius: 24px;
  color: var(--text-dark, #243b38);
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: min(720px, calc(100vh - 112px));
  max-width: 460px;
  overflow: hidden;
  padding: 14px;
  pointer-events: auto;
  width: min(460px, calc(100vw - 48px));
}

.ai-drawer :deep(.ai-chat-panel) {
  flex: 1;
  min-height: 0;
}

.ai-drawer-header {
  align-items: flex-start;
  background: linear-gradient(135deg, var(--pink, #e85a9b), var(--pink-dark, #d44488));
  border-radius: 18px;
  color: #ffffff;
  display: flex;
  flex-shrink: 0;
  gap: 14px;
  justify-content: space-between;
  padding: 16px;
}

.ai-drawer-heading {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  min-width: 0;
}

.ai-drawer-icon {
  align-items: center;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 14px;
  color: #ffffff;
  display: inline-flex;
  flex: 0 0 auto;
  height: 42px;
  justify-content: center;
  line-height: 0;
  width: 42px;
}

.ai-drawer-header p {
  color: rgba(255, 255, 255, 0.85);
  font-weight: 800;
  font-size: 11.5px;
  letter-spacing: 0.08em;
  margin: 0 0 5px;
  text-transform: uppercase;
}

.ai-drawer-header h2 {
  color: #ffffff;
  font-size: 1.35rem;
  line-height: 1.1;
  margin: 0;
}

.ai-drawer-subtitle {
  color: rgba(255, 255, 255, 0.9);
  display: block;
  font-size: 0.88rem;
  font-weight: 700;
  margin-top: 5px;
}

.drawer-close {
  align-items: center;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  color: #ffffff;
  cursor: pointer;
  display: flex;
  flex-shrink: 0;
  font-size: 15px;
  height: 34px;
  justify-content: center;
  line-height: 1;
  transition: background 0.15s ease, transform 0.15s ease;
  width: 34px;
}

.drawer-close:hover {
  background: rgba(255, 255, 255, 0.28);
  transform: rotate(4deg);
}

@media (max-width: 900px) {
  .main-header {
    padding-left: 16px;
    padding-right: 16px;
  }

  .header-row {
    gap: 14px;
  }

  .logo {
    height: 56px;
  }

  .tagline-box {
    margin-left: 12px;
  }
}

@media (max-width: 720px) {
  .tagline-box {
    display: none;
  }
}

@media (max-width: 640px) {
  .main-header {
    padding: 8px 12px 10px;
  }

  .logo {
    height: 44px;
  }

  .header-row {
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  /* Flattened: LanguageSwitcher and .header-account become direct flex items
     of .header-row instead of being boxed inside .header-right. All three
     (logo, account group, language switcher) now compete for one compact
     row; `order` puts them in the requested visual sequence — logo, then
     account, then language — independent of DOM order. flex-wrap (above)
     is the fallback: if a very narrow viewport genuinely can't fit all
     three, the language switcher/account group wrap to a second line
     instead of overflowing or squeezing unreadably. */
  .header-right {
    display: contents;
  }

  .header-account {
    order: 1;
    gap: 8px;
  }

  .header-right :deep(.language-switcher) {
    order: 2;
  }

  .user-chip {
    padding: 4px 10px 4px 4px;
  }

  .user-chip-name {
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Statt horizontalem Scrollen: alle Nav-Pills brechen sauber in mehrere
     Zeilen um, damit jede Seite (inkl. Einkaufsliste, Wochenplan, Über
     Dishly, Kontakt) sofort sichtbar ist, ohne verstecktes Scrollen. */
  .nav-bar {
    flex-wrap: wrap;
    justify-content: center;
    overflow-x: visible;
    gap: 6px;
  }

  .nav-item {
    padding: 8px 13px;
    font-size: 12.5px;
  }

  .main-main {
    display: block;
    min-height: 70vh;
  }

  .main-footer {
    padding: 12px;
  }

  .chat-fab {
    bottom: 14px;
    right: 14px;
    padding: 9px 14px 9px 9px;
  }

  .ai-drawer-backdrop {
    align-items: flex-end;
    background: rgba(46, 52, 55, 0.28);
    padding: 10px;
  }

  .ai-drawer {
    max-height: calc(100vh - 20px);
    max-width: none;
    border-radius: 22px;
    padding: 10px;
    width: 100%;
  }

  .ai-drawer-header {
    border-radius: 18px;
    padding: 14px;
  }

  .ai-drawer-header h2 {
    font-size: 1.16rem;
  }
}
</style>
