<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-bg">
    <header class="main-header">
      <h1 class="brand">
        <span class="chef-hat">🍰</span>
        <span class="chef-text">Dishly</span>
      </h1>
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
  padding: 32px 0 18px 0;
  border-bottom: 2px solid #ffd6ec;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.brand {
  font-size: 2.6rem;
  letter-spacing: 2px;
  font-weight: 900;
  margin: 0 0 8px 0;
  line-height: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.chef-hat {
  font-size: 2.3rem;
}

.chef-text {
  background: linear-gradient(90deg, #ffe0f3 0%, #f5a6d3 100%);
  color: #4a2135;
  padding: 7px 22px;
  border-radius: 24px;
  font-weight: 900;
  letter-spacing: 3px;
  font-size: 2rem;
  box-shadow: 0 2px 10px rgba(255, 182, 193, 0.35);
}

nav {
  display: flex;
  gap: 32px;
  margin-top: 10px;
}

.nav-link {
  color: #e08ab5;
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 1px;
  text-decoration: none;
  opacity: 0.85;
  transition: opacity 0.2s, border-bottom 0.2s;
  padding-bottom: 2px;
  border-bottom: 2px solid transparent;
}

.nav-link:hover,
.router-link-exact-active {
  opacity: 1;
  border-bottom: 2px solid #e08ab5;
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
