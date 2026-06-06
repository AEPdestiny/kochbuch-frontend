<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import dishlyLogo from './assets/dishly-logo.png' // Logo importieren
import { useAuthStore } from '@/stores/authStore'
import router from '@/router'

const authStore = useAuthStore()

onMounted(async () => {
  authStore.initFromStorage()
  if (authStore.token) {
    await authStore.loadCurrentUser()
  }
})

async function logout() {
  authStore.logout()
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
            Deine Rezeptwelt für einfache, leckere Gerichte
          </span>
          <span class="tagline-deco">✦</span>
        </div>
      </div>

      <!-- Hauptnavigation zwischen den Seiten der App -->
      <nav class="nav-bar">
        <RouterLink to="/" class="nav-item">Startseite</RouterLink>
        <RouterLink v-if="authStore.isAuthenticated" to="/dashboard" class="nav-item">Dashboard</RouterLink>
        <RouterLink to="/my-recipes" class="nav-item">Meine Rezepte</RouterLink>
        <RouterLink v-if="authStore.isAuthenticated" to="/pantry" class="nav-item">Vorrat</RouterLink>
        <RouterLink v-if="authStore.isAuthenticated" to="/shopping-list" class="nav-item">Einkaufsliste</RouterLink>
        <RouterLink to="/about" class="nav-item">Über Dishly</RouterLink>
        <RouterLink to="/contact" class="nav-item">Kontakt</RouterLink>
        <template v-if="authStore.isAuthenticated">
          <span class="nav-item user-name">{{ authStore.user?.username ?? 'User' }}</span>
          <button class="nav-item nav-button" type="button" @click="logout">
            Abmelden
          </button>
        </template>
        <template v-else>
          <RouterLink to="/login" class="nav-item">Anmelden</RouterLink>
          <RouterLink to="/register" class="nav-item">Registrieren</RouterLink>
        </template>
      </nav>
    </header>

    <main class="main-main">
      <RouterView />
    </main>

    <footer class="main-footer">
      © 2026 Dishly - Deine Rezeptwelt. Alle Rechte vorbehalten.
    </footer>
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
}

.top-line {
  height: 4px;
  width: 100%;
  background: #8fd5cc;
}

.main-header {
  background: #ffffff;
  border-bottom: 1px solid #dde4e6;
  padding: 12px 8vw 10px 8vw;
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
  display: inline-flex;
  align-self: center;
  background: #f4fbfa;
  border-radius: 999px;
  border: 1px solid #c3e7e1;
  overflow: hidden;
}

.nav-item {
  padding: 8px 22px;
  text-decoration: none;
  color: #486b68;
  font-weight: 600;
  font-size: 0.98rem;
  border-right: 1px solid #ddeeee;
  transition: background 0.2s, color 0.2s, border 0.2s;
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
</style>
