import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { useAuthStore } from '@/stores/authStore'

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
      path: '/recipe/external/:id',
      name: 'external-recipe-detail',
      component: () => import('../views/RecipeDetailView.vue'),
    },
    {
      path: '/recipe/:id',
      name: 'recipe-detail',
      component: () => import('../views/RecipeDetailView.vue'),
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      meta: { requiresAuth: true },
    },
    {
      // Seite zum Verwalten der eigenen Rezepte (CRUD + Favoriten)
      path: '/my-recipes',
      name: 'my-recipes',
      component: () => import('../views/MyRecipesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/recipes/new',
      name: 'new-recipe',
      component: () => import('../views/NewRecipeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/my-recipes/:id/edit',
      name: 'edit-recipe',
      component: () => import('../views/EditRecipeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/pantry',
      name: 'pantry',
      component: () => import('../views/PantryView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/shopping-list',
      name: 'shopping-list',
      component: () => import('../views/ShoppingListView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/meal-plan',
      name: 'meal-plan',
      component: () => import('../views/MealPlanView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/ai',
      name: 'ai-chat',
      component: () => import('../views/AiChatView.vue'),
      meta: { requiresAuth: true },
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

router.beforeEach(async to => {
  if (!to.meta.requiresAuth) {
    return true
  }

  const authStore = useAuthStore()
  if (!authStore.token) {
    authStore.initFromStorage()
  }

  if (!authStore.token) {
    return {
      path: '/login',
      query: { redirect: to.fullPath },
    }
  }

  if (authStore.user) {
    return true
  }

  const currentUser = await authStore.loadCurrentUser()
  if (currentUser) {
    return true
  }

  return {
    path: '/login',
    query: { redirect: to.fullPath },
  }
})

export default router
