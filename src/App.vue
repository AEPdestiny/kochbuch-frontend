<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import dishlyLogo from './assets/dishly-logo.png'
</script>

<template>
  <div class="app-bg">
    <header class="main-header">
      <div class="header-top">
        <RouterLink to="/" class="brand-link">
          <img :src="dishlyLogo" alt="Dishly Logo" class="logo" />
          <span class="brand-name">Dishly</span>
        </RouterLink>

        <div class="header-tagline">
          <span class="tagline-text">
            Deine Rezeptwelt für einfache, leckere Gerichte
          </span>
        </div>
      </div>

      <nav>
        <RouterLink to="/" class="nav-link">Home</RouterLink>
        <RouterLink to="/my-recipes" class="nav-link">Deine Rezepte</RouterLink>
        <RouterLink to="/about" class="nav-link">Über mich</RouterLink>
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

.main-header {
  background: #ffffff;
  padding: 20px 8vw 14px 8vw;
  border-bottom: 2px solid #ffd6ec;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.brand-link {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.logo {
  height: 48px;
}

.brand-name {
  background: linear-gradient(90deg, #ffe0f3 0%, #f5a6d3 100%);
  color: #4a2135;
  padding: 6px 18px;
  border-radius: 22px;
  font-weight: 900;
  letter-spacing: 3px;
  font-size: 1.7rem;
  box-shadow: 0 2px 10px rgba(255, 182, 193, 0.35);
}

.header-tagline {
  padding: 8px 16px;
  border-radius: 20px;
  background: #e0fff8;
  border: 1px solid #a4ede4;
}

.tagline-text {
  color: #e08ab5;
  font-weight: 600;
  font-size: 0.98rem;
}

nav {
  display: flex;
  gap: 28px;
  margin-top: 4px;
}

.nav-link {
  color: #e08ab5;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 1px;
  text-decoration: none;
  opacity: 0.85;
  transition: opacity 0.2s, border-bottom 0.2s, color 0.2s;
  padding-bottom: 2px;
  border-bottom: 2px solid transparent;
}

.nav-link:hover,
.router-link-exact-active {
  opacity: 1;
  color: #26b6b8;
  border-bottom: 2px solid #26b6b8;
}


.main-main {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 100vw;
  min-height: 80vh;
  background: #fffafb;
}

.main-footer {
  text-align: center;
  color: #b3658e;
  background: #fff5fb;
  font-size: 0.98rem;
  padding: 12px 0 10px 0;
  border-top: 2px solid #ffd6ec;
}
</style>
