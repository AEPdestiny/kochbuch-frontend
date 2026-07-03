<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const toastStore = useToastStore()
const { t } = useI18n()

const email = ref('')
const password = ref('')

onMounted(() => {
  authStore.initFromStorage()
})

async function submitLogin() {
  try {
    await authStore.login({
      email: email.value,
      password: password.value,
    })
    toastStore.addToast(
      t('notifications.loginSuccess', { name: authStore.user?.username ?? '' }),
      'success',
    )
    await router.push(getSafeRedirectPath())
  } catch {
    // authStore already exposes the translated error message in authStore.error.
  }
}

// After login, land on the dashboard by default; a pending protected-route
// redirect (set by the router guard) still takes priority when present.
function getSafeRedirectPath() {
  const redirect = route.query.redirect
  if (
    typeof redirect === 'string' &&
    redirect.startsWith('/') &&
    redirect !== '/login' &&
    redirect !== '/register'
  ) {
    return redirect
  }

  return '/dashboard'
}
</script>

<template>
  <section class="auth-page" aria-labelledby="login-title">
    <form class="auth-form" @submit.prevent="submitLogin">
      <h1 id="login-title">{{ t('auth.login.title') }}</h1>

      <label class="field">
        <span>{{ t('auth.login.email') }}</span>
        <input
          v-model="email"
          type="email"
          autocomplete="email"
          required
          :placeholder="t('auth.login.emailPlaceholder', { at: '@' })"
        />
      </label>

      <label class="field">
        <span>{{ t('auth.login.password') }}</span>
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          :placeholder="t('auth.login.passwordPlaceholder')"
        />
      </label>

      <p v-if="authStore.error" class="error-message" role="alert">
        {{ authStore.error }}
      </p>

      <button class="submit-button" type="submit" :disabled="authStore.loading">
        {{ authStore.loading ? t('auth.login.loading') : t('auth.login.submit') }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.auth-page {
  width: 100%;
  min-height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  background: var(--page-bg, #fafcfb);
}

.auth-form {
  width: min(100%, 420px);
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 32px;
  border-radius: var(--radius-card, 18px);
  background: #ffffff;
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  box-sizing: border-box;
}

.auth-form h1 {
  margin: 0;
  color: var(--pink-dark, #d44488);
  font-size: 1.8rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--text-gray, #6b7478);
  font-weight: 600;
}

.field input {
  width: 100%;
  min-height: 44px;
  padding: 10px 14px;
  border: 1.5px solid var(--line, #e6ecea);
  border-radius: 12px;
  color: var(--text-dark, #2e3437);
  outline: none;
  transition: border-color 0.16s ease;
}

.field input:focus {
  border-color: var(--mint, #5ecbb5);
  outline: none;
}

.submit-button {
  min-height: 44px;
  border: none;
  border-radius: var(--radius-pill, 999px);
  background: var(--pink, #e85a9b);
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.16s ease, transform 0.16s ease;
}

.submit-button:hover:not(:disabled) {
  background: var(--pink-dark, #d44488);
  transform: translateY(-1px);
}

.submit-button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.error-message {
  margin: 0;
  background: var(--pink-light, #fdeef5);
  border-radius: 10px;
  padding: 10px 14px;
  color: var(--pink-dark, #d44488);
  font-weight: 600;
}

@media (max-width: 640px) {
  .auth-page {
    align-items: flex-start;
    min-height: 60vh;
    padding: 24px 12px;
  }

  .auth-form {
    gap: 16px;
    padding: 22px 16px;
  }

  .auth-form h1 {
    font-size: 1.55rem;
    line-height: 1.2;
  }
}
</style>
