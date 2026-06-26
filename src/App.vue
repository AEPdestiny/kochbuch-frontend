<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useI18n } from 'vue-i18n'
import dishlyLogo from './assets/dishly-logo.png' // Logo importieren
import { useAuthStore } from '@/stores/authStore'
import router from '@/router'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import AiChatPanel from '@/components/AiChatPanel.vue'

const authStore = useAuthStore()
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
  aiDrawerOpen.value = false
  await router.push('/')
}
</script>

<template>
  <div class="app-bg">
    <!-- Oberer Bereich mit Logo, Tagline und Navigation -->
    <header class="main-header">
      <!-- Farbige Linie ganz oben zur visuellen Trennung -->
      <div class="top-line"></div>

      <!-- Zeile mit Logo links und Tagline rechts -->
      <div class="header-row">
        <!-- Klickbares Logo führt immer zur Home-Seite -->
        <RouterLink to="/" class="logo-link">
          <img :src="dishlyLogo" alt="Dishly logo" class="logo" />
        </RouterLink>

        <!-- Box mit Slogan in der Mitte/Rechts -->
        <div class="tagline-box">
          <span class="tagline-deco">✦</span>
          <span class="tagline-text">
            {{ t('app.tagline') }}
          </span>
          <span class="tagline-deco">✦</span>
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
        <LanguageSwitcher />
        <template v-if="authStore.isAuthenticated">
          <span class="nav-item user-name">{{ authStore.user?.username ?? t('app.userFallback') }}</span>
          <button class="nav-item nav-button" type="button" @click="logout">
            {{ t('navigation.logout') }}
          </button>
        </template>
        <template v-else>
          <RouterLink to="/login" class="nav-item">{{ t('navigation.login') }}</RouterLink>
          <RouterLink to="/register" class="nav-item">{{ t('navigation.register') }}</RouterLink>
        </template>
      </nav>
    </header>

    <main class="main-main">
      <RouterView />
    </main>

    <footer class="main-footer">
      {{ t('app.footer', { year: 2026 }) }}
    </footer>

    <button
      v-if="authStore.isAuthenticated"
      type="button"
      class="chat-fab"
      @click="aiDrawerOpen = true"
    >
      Dishly AI
    </button>

    <div v-if="authStore.isAuthenticated && aiDrawerOpen" class="ai-drawer-backdrop" @click.self="aiDrawerOpen = false">
      <aside class="ai-drawer" aria-label="Dishly AI Chat">
        <div class="ai-drawer-header">
          <div>
            <p>Dishly AI</p>
            <h2>{{ t('ai.drawerTitle') }}</h2>
          </div>
          <button type="button" class="drawer-close" @click="aiDrawerOpen = false">{{ t('ai.close') }}</button>
        </div>
        <AiChatPanel />
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* Google-Font für die gesamte App einbinden */
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');

/* Layout, damit Footer unten bleibt */
.app-bg {
  min-height: 100vh;
  width: 100%;
  background: #ffffff;
  font-family: 'Roboto', Arial, sans-serif;
  color: #2b1b23;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}

.top-line {
  height: 4px;
  width: 100%;
  background: #8fd5cc;
}

.main-header {
  background: #ffffff;
  border-bottom: 1px solid #dde4e6;
  padding: 12px clamp(14px, 8vw, 120px) 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Zeile mit Logo und Tagline nebeneinander */
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
}

/* Höhe des Logos */
.logo {
  height: 100px;
  width: auto;
}

.tagline-box {
  flex: 1;
  margin-left: 24px;
  padding: 10px 18px;
  border-radius: 24px;
  background: #eefaf8;
  border: 1px solid #c3e7e1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.tagline-text {
  color: #cc7da9;
  font-weight: 600;
  font-size: 1rem;
  text-align: center;
}

.tagline-deco {
  color: #8fd5cc;
  font-size: 0.95rem;
}

.nav-bar {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-self: center;
  background: #f4fbfa;
  border-radius: 999px;
  border: 1px solid #c3e7e1;
  max-width: 100%;
  overflow: visible;
}

.nav-item {
  align-items: center;
  display: inline-flex;
  justify-content: center;
  min-height: 44px;
  padding: 8px 22px;
  text-decoration: none;
  color: #486b68;
  font-weight: 600;
  font-size: 0.98rem;
  border-right: 1px solid #ddeeee;
  text-align: center;
  transition: background 0.2s, color 0.2s, border 0.2s;
  white-space: normal;
}

/* Rechts außen kein Trenner mehr */
.nav-item:last-child {
  border-right: none;
}

.nav-item:hover,
.nav-item.router-link-exact-active {
  background: #8fd5cc;
  color: #ffffff;
}

.nav-button {
  border-top: none;
  border-bottom: none;
  border-left: none;
  background: transparent;
  font-family: inherit;
  cursor: pointer;
}

.user-name {
  color: #2b1b23;
  cursor: default;
}

.user-name:hover {
  background: transparent;
  color: #2b1b23;
}

.main-main {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 100%;
  min-width: 0;
  min-height: 80vh;
  background: #ffffff;
}

.main-footer {
  text-align: center;
  color: #486b68;
  background: #f4fbfa;
  font-size: 0.98rem;
  padding: 12px 0 10px 0;
  border-top: 1px solid #dde4e6;
}

.chat-fab {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 45;
  border: none;
  border-radius: 999px;
  background: #cc7da9;
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  padding: 12px 18px;
  box-shadow: 0 8px 24px rgba(65, 30, 50, 0.22);
}

.ai-drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(25, 44, 42, 0.24);
  display: flex;
  justify-content: flex-end;
}

.ai-drawer {
  background: #ffffff;
  box-shadow: -10px 0 28px rgba(65, 30, 50, 0.18);
  color: #243b38;
  display: grid;
  gap: 16px;
  max-width: 480px;
  overflow-y: auto;
  padding: 20px;
  width: min(100%, 480px);
}

.ai-drawer-header {
  align-items: start;
  display: flex;
  gap: 14px;
  justify-content: space-between;
}

.ai-drawer-header p {
  color: #2f8f7b;
  font-weight: 800;
  margin: 0 0 4px;
  text-transform: uppercase;
}

.ai-drawer-header h2 {
  color: #cc7da9;
  margin: 0;
}

.drawer-close {
  background: #ffffff;
  border: 1px solid #c3e7e1;
  border-radius: 999px;
  color: #486b68;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  padding: 8px 12px;
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
    height: 82px;
  }

  .tagline-box {
    margin-left: 0;
  }

  .nav-bar {
    border-radius: 20px;
  }

  .nav-item {
    flex: 1 1 auto;
    padding: 9px 16px;
  }
}

@media (max-width: 640px) {
  .main-header {
    padding: 10px 12px 12px;
  }

  .header-row {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
  }

  .logo-link {
    justify-content: center;
  }

  .logo {
    height: 68px;
  }

  .tagline-box {
    border-radius: 16px;
    padding: 8px 12px;
    width: 100%;
  }

  .tagline-deco {
    display: none;
  }

  .tagline-text {
    font-size: 0.92rem;
    line-height: 1.35;
  }

  .nav-bar {
    align-self: stretch;
    border-radius: 16px;
    gap: 6px;
    padding: 6px;
  }

  .nav-item {
    border: none;
    border-radius: 12px;
    flex: 1 1 calc(50% - 6px);
    font-size: 0.94rem;
    min-width: 130px;
    padding: 10px 12px;
  }

  .nav-button {
    border: none;
  }

  .user-name {
    flex-basis: 100%;
    min-width: 100%;
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
    padding: 10px 14px;
  }

  .ai-drawer-backdrop {
    align-items: stretch;
  }

  .ai-drawer {
    max-width: none;
    padding: 16px;
    width: 100%;
  }
}
</style>
