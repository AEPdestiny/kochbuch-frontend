<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import dishlyLogo from './assets/dishly-logo.png'
</script>

<template>
  <div class="app-bg">
    <header class="main-header">
      <div class="top-line"></div>

      <div class="header-row">
        <RouterLink to="/" class="logo-link">
          <img :src="dishlyLogo" alt="Dishly Logo" class="logo" />
        </RouterLink>

        <div class="tagline-box">
          <span class="tagline-deco">✦</span>
          <span class="tagline-text">
            Deine Rezeptwelt für einfache, leckere Gerichte
          </span>
          <span class="tagline-deco">✦</span>
        </div>
      </div>

      <nav class="nav-bar">
        <RouterLink to="/" class="nav-item">Home</RouterLink>
        <RouterLink to="/my-recipes" class="nav-item">Deine Rezepte</RouterLink>
        <RouterLink to="/about" class="nav-item">Über mich</RouterLink>
      </nav>
    </header>

    <main class="main-main">
      <RouterView />
    </main>

    <footer class="main-footer">© 2026 Dishly – Dein Rezeptportal</footer>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');

.app-bg {
  min-height: 100vh;
  width: 100vw;
  background: #ffffff;
  font-family: 'Roboto', Arial, sans-serif;
  color: #2b1b23;
  display: flex;
  flex-direction: column;
}

.top-line {
  height: 4px;
  width: 100%;
  background: #a4ede4;
}

.main-header {
  background: #ffffff;
  border-bottom: 2px solid #ffd6ec;
  padding: 12px 8vw 10px 8vw;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.logo-link {
  display: flex;
  align-items: center;
}

.logo {
  height: 56px;
}

.tagline-box {
  flex: 1;
  margin-left: 24px;
  padding: 10px 18px;
  border-radius: 24px;
  background: #fff5fb;
  border: 1px solid #ffd6ec;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.tagline-text {
  color: #e08ab5;
  font-weight: 600;
  font-size: 1rem;
  text-align: center;
}

.tagline-deco {
  color: #e8a4c5;
  font-size: 0.95rem;
}

.nav-bar {
  margin-top: 8px;
  display: inline-flex;
  align-self: center;
  background: #e0fff8;
  border-radius: 999px;
  border: 1px solid #a4ede4;
  overflow: hidden;
}

.nav-item {
  padding: 8px 22px;
  text-decoration: none;
  color: #e08ab5;
  font-weight: 600;
  font-size: 0.98rem;
  border-right: 1px solid #c7f5ec;
  transition: background 0.2s, color 0.2s, border 0.2s;
}

.nav-item:last-child {
  border-right: none;
}

.nav-item:hover,
.router-link-exact-active {
  background: #ffffff;
  color: #e08ab5;
}
</style>
