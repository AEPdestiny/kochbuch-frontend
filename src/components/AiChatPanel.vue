<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Wand } from 'reicon-vue'
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
const messagesEl = ref<HTMLDivElement | null>(null)
const messages = ref<ChatMessage[]>([
  {
    role: 'assistant',
    text: GREETING_TEXT,
  },
])

// Solange nur die Begrüßung da ist, zeigen wir den freundlichen Einstieg mit Vorschlägen
// statt der (noch leeren) Chat-Verlauf-Box.
const showEmptyState = computed(() => messages.value.length <= 1)

async function scrollMessagesToBottom({ smooth = true } = {}) {
  await nextTick()

  const element = messagesEl.value
  if (!element) return

  if (typeof element.scrollTo === 'function') {
    element.scrollTo({
      top: element.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    })
  } else {
    element.scrollTop = element.scrollHeight
  }
}

async function sendPrompt(text: string) {
  if (loading.value) return
  message.value = ''
  await submitMessage(text)
}

async function sendMessage() {
  await submitMessage(message.value)
}

function handleMessageKeydown(event: KeyboardEvent) {
  if (event.shiftKey) return

  event.preventDefault()
  if (loading.value) return

  void sendMessage()
}

async function submitMessage(text: string) {
  if (loading.value) return

  const value = text.trim()
  if (!value) {
    error.value = 'Bitte gib eine Frage ein.'
    return
  }

  messages.value.push({ role: 'user', text: value })
  message.value = ''
  loading.value = true
  error.value = null
  await scrollMessagesToBottom()

  try {
    const response = await aiApi.chat({ message: value })
    messages.value.push({ role: 'assistant', text: response.message })
    await scrollMessagesToBottom()
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
      <div class="ai-empty-icon" aria-hidden="true">
        <Wand class="ai-wand-icon" :size="22" weight="Filled" />
      </div>
      <div class="ai-empty-copy">
        <p class="ai-empty-kicker">Bereit für deine Küche</p>
        <p class="ai-empty-text">{{ GREETING_TEXT }}</p>
      </div>
      <div class="ai-suggestions">
        <button
          v-for="suggestion in PROMPT_SUGGESTIONS"
          :key="suggestion"
          type="button"
          class="ai-suggestion-chip"
          :disabled="loading"
          @click="sendPrompt(suggestion)"
        >
          {{ suggestion }}
        </button>
      </div>
    </div>

    <div v-else ref="messagesEl" class="chat-box">
      <article
        v-for="(item, index) in messages"
        :key="`${item.role}-${index}`"
        class="chat-message"
        :class="item.role"
      >
        <span class="message-role">{{ item.role === 'assistant' ? 'Dishly AI' : 'Du' }}</span>
        <span>{{ item.text }}</span>
      </article>
      <article v-if="loading" class="chat-message assistant typing" aria-live="polite">
        <span class="message-role">Dishly AI</span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </article>
    </div>

    <p v-if="error" class="status-text error" role="alert">{{ error }}</p>

    <form class="chat-form" @submit.prevent="sendMessage">
      <label class="chat-input-label" for="dishly-ai-message">Deine Frage</label>
      <div class="chat-input-shell">
        <textarea
          id="dishly-ai-message"
          v-model="message"
          placeholder="z. B. Was kann ich diese Woche mit meinem Vorrat kochen?"
          :disabled="loading"
          @keydown.enter="handleMessageKeydown"
        ></textarea>
        <button type="submit" class="chat-send-btn" :disabled="loading">
          {{ loading ? 'Sendet...' : 'Senden' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.ai-chat-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
}

/* Freundlicher Einstieg, solange noch keine echte Konversation läuft */
.ai-empty-state {
  align-items: flex-start;
  background: linear-gradient(180deg, #ffffff 0%, var(--mint-bg, #ecfaf6) 100%);
  border: 1px solid rgba(94, 203, 181, 0.26);
  border-radius: 18px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  text-align: left;
}

.ai-empty-icon {
  align-items: center;
  background: var(--pink, #e85a9b);
  border-radius: 16px;
  box-shadow: 0 10px 22px rgba(232, 90, 155, 0.2);
  color: #ffffff;
  display: inline-flex;
  height: 44px;
  justify-content: center;
  line-height: 0;
  width: 44px;
}

.ai-wand-icon {
  color: currentColor;
  display: block;
  flex-shrink: 0;
}

.ai-empty-copy {
  display: grid;
  gap: 6px;
}

.ai-empty-kicker {
  color: var(--pink-dark, #d44488);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  margin: 0;
  text-transform: uppercase;
}

.ai-empty-text {
  color: var(--text-dark, #2e3437);
  font-size: 0.94rem;
  font-weight: 600;
  line-height: 1.55;
  margin: 0;
  max-width: 420px;
}

.ai-suggestions {
  display: grid;
  gap: 8px;
  grid-template-columns: 1fr;
  width: 100%;
}

.ai-suggestion-chip {
  background: #ffffff;
  border: 1px solid rgba(94, 203, 181, 0.38);
  border-radius: 12px;
  color: var(--text-dark, #2e3437);
  cursor: pointer;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 800;
  padding: 10px 12px;
  text-align: left;
  transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
}

.ai-suggestion-chip:hover {
  background: var(--mint-bg, #ecfaf6);
  border-color: var(--mint, #5ecbb5);
  transform: translateY(-1px);
}

.ai-suggestion-chip:disabled {
  cursor: wait;
  opacity: 0.64;
  transform: none;
}

.chat-box {
  background: var(--mint-bg, #ecfaf6);
  border: 1px solid rgba(94, 203, 181, 0.24);
  border-radius: 18px;
  display: grid;
  flex: 1 1 auto;
  gap: 12px;
  max-height: min(46vh, 430px);
  min-height: 0;
  overflow-y: auto;
  padding: 14px;
  scrollbar-width: thin;
}

.chat-message {
  display: grid;
  gap: 5px;
  border-radius: 16px;
  line-height: 1.48;
  max-width: 86%;
  padding: 11px 13px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.chat-message.assistant {
  background: #ffffff;
  border: 1px solid rgba(94, 203, 181, 0.16);
  border-radius: 6px 16px 16px 16px;
  box-shadow: 0 8px 18px rgba(61, 174, 155, 0.08);
  color: var(--text-dark, #2e3437);
  justify-self: start;
}

.chat-message.user {
  background: var(--pink, #e85a9b);
  border-radius: 16px 6px 16px 16px;
  box-shadow: 0 10px 20px rgba(232, 90, 155, 0.18);
  color: #ffffff;
  justify-self: end;
}

.message-role {
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  opacity: 0.76;
  text-transform: uppercase;
}

.chat-message.assistant .message-role {
  color: var(--pink, #e85a9b);
  opacity: 1;
}

.chat-message.typing {
  align-items: center;
  display: inline-flex;
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
  flex: 0 0 auto;
  gap: 8px;
  margin-top: auto;
  position: sticky;
  bottom: 0;
  z-index: 1;
}

.chat-input-label {
  color: var(--text-gray, #6b7478);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.chat-input-shell {
  align-items: end;
  background: #ffffff;
  border: 1.5px solid rgba(94, 203, 181, 0.36);
  border-radius: 18px;
  box-shadow: 0 8px 20px rgba(61, 174, 155, 0.08);
  display: grid;
  gap: 10px;
  grid-template-columns: 1fr auto;
  padding: 8px;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.chat-input-shell:focus-within {
  border-color: var(--mint, #5ecbb5);
  box-shadow: 0 10px 24px rgba(61, 174, 155, 0.14);
}

.chat-form textarea {
  background: transparent;
  border: none;
  border-radius: 12px;
  font: inherit;
  line-height: 1.4;
  max-height: 120px;
  min-height: 52px;
  padding: 10px 8px;
  resize: none;
}

.chat-form textarea:focus {
  outline: none;
}

.chat-send-btn {
  background: var(--pink, #e85a9b);
  border: none;
  border-radius: 999px;
  box-shadow: 0 8px 18px rgba(232, 90, 155, 0.2);
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 900;
  min-height: 42px;
  padding: 9px 16px;
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
  border: 1px solid rgba(232, 90, 155, 0.22);
  border-left: 4px solid var(--pink, #e85a9b);
  border-radius: 12px;
  color: var(--pink-dark, #d44488);
  font-weight: 600;
  margin: 0;
  padding: 10px 14px;
}

@media (max-width: 640px) {
  .ai-chat-panel {
    min-height: 0;
  }

  .chat-box {
    max-height: 52vh;
    padding: 12px;
  }

  .chat-message {
    max-width: 94%;
  }

  .ai-empty-state {
    padding: 16px;
  }

  .chat-input-shell {
    gap: 8px;
    grid-template-columns: 1fr;
  }

  .chat-send-btn {
    width: 100%;
  }
}
</style>
