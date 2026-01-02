<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-bg">
    <header class="main-header">
      <h1 class="brand">
        <span class="chef-hat">👨‍🍳</span>
        <span class="chef-text">Dishly</span>
      </h1>
      <nav>
        <RouterLink to="/" class="nav-link">Start</RouterLink>
        <RouterLink to="/about" class="nav-link">Über</RouterLink>
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
  background: #fff;
  font-family: 'Roboto', Arial, sans-serif;
  color: #131313;
  display: flex;
  flex-direction: column;
}
.main-header {
  background: #fff;
  color: #388e3c;
  padding: 38px 0 20px 0;
  border-bottom: 2.5px solid #e3f6e8;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.brand {
  font-family: 'Roboto', Arial, sans-serif;
  font-size: 2.8rem;
  letter-spacing: 2px;
  font-weight: 900;
  margin: 0 0 8px 0;
  line-height: 1;
  display: flex;
  align-items: center;
  gap: 14px;
}
.chef-hat {
  font-size: 2.4rem;
}
.chef-text {
  background: linear-gradient(90deg,#4ec77f 40%,#198a49 100%);
  color: #fff;
  padding: 7px 22px;
  border-radius: 22px;
  font-weight: 900;
  letter-spacing: 3px;
  font-size: 2.1rem;
  box-shadow: 0 1px 8px 0 rgba(33,120,54,0.07);
}
nav {
  display: flex;
  gap: 36px;
  margin-top: 10px;
}
.nav-link {
  color: #198a49;
  font-size: 1.17rem;
  font-weight: 600;
  letter-spacing: 1px;
  text-decoration: none;
  opacity: 0.85;
  transition: opacity 0.2s;
}
.nav-link:hover,
.router-link-exact-active {
  opacity: 1;
  text-decoration: underline;
}
.main-main {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 100vw;
  min-height: 80vh;
  background: #fff;
}
.main-footer {
  text-align: center;
  color: #388e3c;
  background: #f6fff3;
  font-size: 1rem;
  padding: 14px 0 11px 0;
  border-top: 2px solid #e3f6e8;
}
</style>
