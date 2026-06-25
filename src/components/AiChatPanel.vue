<script setup lang="ts">
import { ref } from 'vue'
import { ApiClientError } from '@/shared/api/apiClient'
import { aiApi } from '@/shared/api/aiApi'

type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
}

const message = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const messages = ref<ChatMessage[]>([
  {
    role: 'assistant',
    text: 'Frag Dishly AI nach deinem Wochenplan, Vorrat, Kalorienziel oder passenden Rezeptideen.',
  },
])

async function sendMessage() {
  const value = message.value.trim()
  if (!value) {
    error.value = 'Bitte gib eine Frage ein.'
    return
  }

  messages.value.push({ role: 'user', text: value })
  message.value = ''
  loading.value = true
  error.value = null

  try {
    const response = await aiApi.chat({ message: value })
    messages.value.push({ role: 'assistant', text: response.message })
  } catch (e: unknown) {
    if (e instanceof ApiClientError && e.status === 401) {
      error.value = 'Bitte melde dich erneut an, um Dishly AI zu nutzen.'
    } else if (e instanceof ApiClientError && e.message) {
      error.value = e.message
    } else {
      error.value = 'Dishly AI konnte gerade nicht antworten.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="ai-chat-panel">
    <div class="chat-box">
      <article
        v-for="(item, index) in messages"
        :key="`${item.role}-${index}`"
        class="chat-message"
        :class="item.role"
      >
        {{ item.text }}
      </article>
    </div>

    <p v-if="error" class="status-text error" role="alert">{{ error }}</p>

    <form class="chat-form" @submit.prevent="sendMessage">
      <textarea
        v-model="message"
        placeholder="z. B. Was kann ich diese Woche mit meinem Vorrat kochen?"
        :disabled="loading"
      ></textarea>
      <button type="submit" :disabled="loading">
        {{ loading ? 'Dishly AI antwortet...' : 'Frage senden' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.ai-chat-panel {
  display: grid;
  gap: 14px;
}

.chat-box {
  background: #f4fbfa;
  border: 1px solid #c3e7e1;
  border-radius: 16px;
  display: grid;
  gap: 10px;
  max-height: 420px;
  overflow-y: auto;
  padding: 16px;
}

.chat-message {
  border-radius: 14px;
  line-height: 1.45;
  max-width: 82%;
  padding: 10px 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.chat-message.assistant {
  background: #ffffff;
  border: 1px solid #d6eee9;
  justify-self: start;
}

.chat-message.user {
  background: #cc7da9;
  color: #ffffff;
  justify-self: end;
}

.chat-form {
  display: grid;
  gap: 10px;
}

.chat-form textarea {
  border: 1.5px solid #c3e7e1;
  border-radius: 12px;
  font: inherit;
  min-height: 110px;
  padding: 12px;
}

.chat-form button {
  justify-self: start;
  border: none;
  border-radius: 999px;
  background: #cc7da9;
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  min-height: 44px;
  padding: 10px 18px;
}

.chat-form button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.status-text.error {
  color: #a14c2b;
  font-weight: 700;
}

@media (max-width: 640px) {
  .chat-box {
    max-height: 55vh;
    padding: 12px;
  }

  .chat-message {
    max-width: 94%;
  }

  .chat-form button {
    justify-self: stretch;
    width: 100%;
  }
}
</style>
