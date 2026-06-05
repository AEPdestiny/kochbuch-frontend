import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  // Definition aller Seiten/Views mit ihrer URL
  routes: [
    {
      // Startseite: Rezept-Discovery mit externen + eigenen veröffentlichten Rezepten
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      // Seite zum Verwalten der eigenen Rezepte (CRUD + Favoriten)
      path: '/my-recipes',
      name: 'my-recipes',
      component: () => import('../views/MyRecipesView.vue'),
    },
    {
      // About-Seite mit Informationen zur App
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
    {
      // Contact-Seite mit Kontaktdaten
      path: '/contact',
      name: 'contact',
      component: () => import('../views/ContactView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
    },
  ],
})

export default router
