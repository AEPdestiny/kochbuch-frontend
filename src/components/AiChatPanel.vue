<script setup lang="ts">
import { computed, ref } from 'vue'
import { ApiClientError } from '@/shared/api/apiClient'
import { aiApi } from '@/shared/api/aiApi'

type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
}

const PROMPT_SUGGESTIONS = [
  'Was kann ich heute mit meinem Vorrat kochen?',
  'Schlage mir ein Rezept für mein Kalorienziel vor.',
  'Was steht diese Woche auf meinem Wochenplan?',
  'Gib mir eine schnelle Idee fürs Abendessen.',
]

const GREETING_TEXT = 'Frag Dishly AI nach deinem Wochenplan, Vorrat, Kalorienziel oder passenden Rezeptideen.'

const message = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const messages = ref<ChatMessage[]>([
  {
    role: 'assistant',
    text: GREETING_TEXT,
  },
])

// Solange nur die Begrüßung da ist, zeigen wir den freundlichen Einstieg mit Vorschlägen
// statt der (noch leeren) Chat-Verlauf-Box.
const showEmptyState = computed(() => messages.value.length <= 1)

function selectSuggestion(text: string) {
  message.value = text
}

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
    <div v-if="showEmptyState" class="ai-empty-state">
      <div class="ai-empty-icon">🍳</div>
      <p class="ai-empty-text">{{ GREETING_TEXT }}</p>
      <div class="ai-suggestions">
        <button
          v-for="suggestion in PROMPT_SUGGESTIONS"
          :key="suggestion"
          type="button"
          class="ai-suggestion-chip"
          @click="selectSuggestion(suggestion)"
        >
          {{ suggestion }}
        </button>
      </div>
    </div>

    <div v-else class="chat-box">
      <article
        v-for="(item, index) in messages"
        :key="`${item.role}-${index}`"
        class="chat-message"
        :class="item.role"
      >
        {{ item.text }}
      </article>
      <article v-if="loading" class="chat-message assistant typing" aria-live="polite">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </article>
    </div>

    <p v-if="error" class="status-text error" role="alert">⚠️ {{ error }}</p>

    <form class="chat-form" @submit.prevent="sendMessage">
      <textarea
        v-model="message"
        placeholder="z. B. Was kann ich diese Woche mit meinem Vorrat kochen?"
        :disabled="loading"
      ></textarea>
      <button type="submit" class="chat-send-btn" :disabled="loading">
        {{ loading ? 'Dishly AI antwortet...' : 'Frage senden' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.ai-chat-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Freundlicher Einstieg, solange noch keine echte Konversation läuft */
.ai-empty-state {
  align-items: center;
  background: var(--mint-bg, #ecfaf6);
  border-radius: var(--radius-card, 18px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 28px 20px;
  text-align: center;
}

.ai-empty-icon {
  font-size: 2.4rem;
  line-height: 1;
}

.ai-empty-text {
  color: var(--mint-darker, #2b8c7b);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  margin: 0;
  max-width: 420px;
}

.ai-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.ai-suggestion-chip {
  background: #ffffff;
  border: 1.5px solid var(--mint, #5ecbb5);
  border-radius: var(--radius-pill, 999px);
  color: var(--mint-darker, #2b8c7b);
  cursor: pointer;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 9px 16px;
  transition: background 0.16s ease, color 0.16s ease;
}

.ai-suggestion-chip:hover {
  background: var(--mint, #5ecbb5);
  color: #ffffff;
}

.chat-box {
  background: var(--mint-bg, #f4fbfa);
  border-radius: var(--radius-card, 16px);
  display: grid;
  gap: 12px;
  max-height: 420px;
  overflow-y: auto;
  padding: 18px;
}

.chat-message {
  border-radius: 16px;
  line-height: 1.45;
  max-width: 82%;
  padding: 11px 15px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.chat-message.assistant {
  background: #ffffff;
  border-radius: 4px 16px 16px 16px;
  box-shadow: var(--shadow-sm, 0 2px 10px rgba(61, 174, 155, 0.06));
  color: var(--text-dark, #2e3437);
  justify-self: start;
}

.chat-message.user {
  background: var(--pink, #e85a9b);
  border-radius: 16px 4px 16px 16px;
  color: #ffffff;
  justify-self: end;
}

.chat-message.typing {
  align-items: center;
  display: flex;
  gap: 5px;
  padding: 14px 16px;
}

.typing-dot {
  animation: typingBounce 1.1s ease-in-out infinite;
  background: var(--mint-dark, #3dae9b);
  border-radius: 50%;
  height: 7px;
  width: 7px;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes typingBounce {
  0%, 60%, 100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

.chat-form {
  display: grid;
  gap: 10px;
}

.chat-form textarea {
  border: 1.5px solid var(--line, #c3e7e1);
  border-radius: 14px;
  font: inherit;
  min-height: 110px;
  padding: 12px 14px;
  resize: vertical;
}

.chat-form textarea:focus {
  border-color: var(--mint, #5ecbb5);
  outline: none;
}

.chat-send-btn {
  background: var(--pink, #cc7da9);
  border: none;
  border-radius: var(--radius-pill, 999px);
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  justify-self: start;
  min-height: 44px;
  padding: 10px 22px;
  transition: background 0.16s ease, transform 0.16s ease;
}

.chat-send-btn:hover:not(:disabled) {
  background: var(--pink-dark, #d44488);
  transform: translateY(-1px);
}

.chat-send-btn:disabled {
  cursor: wait;
  opacity: 0.7;
}

.status-text.error {
  background: var(--pink-light, #fdeef5);
  border-left: 3px solid var(--pink, #e85a9b);
  border-radius: 10px;
  color: var(--pink-dark, #d44488);
  font-weight: 600;
  margin: 0;
  padding: 10px 14px;
}

@media (max-width: 640px) {
  .chat-box {
    max-height: 55vh;
    padding: 12px;
  }

  .chat-message {
    max-width: 94%;
  }

  .ai-empty-state {
    padding: 22px 16px;
  }

  .chat-send-btn {
    justify-self: stretch;
    width: 100%;
  }
}
</style>
