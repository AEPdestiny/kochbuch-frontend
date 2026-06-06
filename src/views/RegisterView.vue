<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const email = ref('')
const password = ref('')

async function submitRegister() {
  await authStore.register({
    username: username.value,
    email: email.value,
    password: password.value,
  })
  await router.push('/')
}
</script>

<template>
  <section class="auth-page" aria-labelledby="register-title">
    <form class="auth-form" @submit.prevent="submitRegister">
      <h1 id="register-title">Registrieren</h1>

      <label class="field">
        <span>Benutzername</span>
        <input
          v-model="username"
          type="text"
          autocomplete="username"
          required
          placeholder="salma"
        />
      </label>

      <label class="field">
        <span>E-Mail</span>
        <input
          v-model="email"
          type="email"
          autocomplete="email"
          required
          placeholder="salma@example.com"
        />
      </label>

      <label class="field">
        <span>Passwort</span>
        <input
          v-model="password"
          type="password"
          autocomplete="new-password"
          minlength="8"
          required
          placeholder="Mindestens 8 Zeichen"
        />
      </label>

      <p v-if="authStore.error" class="error-message" role="alert">
        {{ authStore.error }}
      </p>

      <button class="submit-button" type="submit" :disabled="authStore.loading">
        {{ authStore.loading ? 'Registrierung läuft...' : 'Konto erstellen' }}
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
}

.auth-form {
  width: min(100%, 420px);
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 28px;
  border: 1px solid #c3e7e1;
  border-radius: 8px;
  background: #ffffff;
}

.auth-form h1 {
  margin: 0;
  color: #2b1b23;
  font-size: 1.8rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #486b68;
  font-weight: 600;
}

.field input {
  width: 100%;
  min-height: 42px;
  padding: 10px 12px;
  border: 1px solid #c3e7e1;
  border-radius: 6px;
  color: #2b1b23;
}

.field input:focus {
  outline: 2px solid #8fd5cc;
  outline-offset: 2px;
}

.submit-button {
  min-height: 44px;
  border: none;
  border-radius: 6px;
  background: #8fd5cc;
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
}

.submit-button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.error-message {
  margin: 0;
  color: #a83252;
  font-weight: 600;
}
</style>
