import './assets/tokens.css'
import './assets/main.css'
import './assets/reset.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { useAuthStore } from './stores/authStore'
import { configureUnauthorizedHandler } from './shared/api/apiClient'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(i18n)

const authStore = useAuthStore(pinia)
configureUnauthorizedHandler(async redirectPath => {
  authStore.handleSessionExpired()
  const safeRedirect =
    redirectPath && redirectPath !== '/login' && redirectPath !== '/register'
      ? redirectPath
      : '/'

  if (router.currentRoute.value.path !== '/login') {
    await router.push({
      path: '/login',
      query: { redirect: safeRedirect },
    })
  }
})

app.mount('#app')
