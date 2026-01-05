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
          <img :src="dishlyLogo" alt="Dishly logo" class="logo" />
        </RouterLink>

        <div class="tagline-box">
          <span class="tagline-deco">✦</span>
          <span class="tagline-text">
            Your Recipeworld for simple, tasty recipes
          </span>
          <span class="tagline-deco">✦</span>
        </div>
      </div>

      <nav class="nav-bar">
        <RouterLink to="/" class="nav-item">Home</RouterLink>
        <RouterLink to="/my-recipes" class="nav-item">Your recipes</RouterLink>
        <RouterLink to="/about" class="nav-item">About</RouterLink>
        <RouterLink to="/contact" class="nav-item">Contact</RouterLink>
      </nav>
    </header>

    <main class="main-main">
      <RouterView />
    </main>

    <footer class="main-footer">
      © 2026 Dishly – Your recipe hub. All rights reserved.
    </footer>
  </div>
</template>


<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');

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

.nav-item:last-child {
  border-right: none;
}

.nav-item:hover,
.nav-item.router-link-exact-active {
  background: #8fd5cc;
  color: #ffffff;
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
