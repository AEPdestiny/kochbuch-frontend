<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
}>()

const emit = defineEmits<{
  cancel: []
  confirm: []
}>()

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('cancel')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="confirm-overlay" role="presentation" @click.self="emit('cancel')">
      <section
        class="confirm-card"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <div class="confirm-accent" aria-hidden="true"></div>
        <h2>{{ title }}</h2>
        <p>{{ message }}</p>
        <div class="confirm-actions">
          <button type="button" class="cancel-button" @click="emit('cancel')">
            {{ cancelLabel }}
          </button>
          <button
            type="button"
            class="confirm-button"
            :class="{ danger }"
            @click="emit('confirm')"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(46, 52, 55, 0.42);
}

.confirm-card {
  position: relative;
  width: min(420px, 100%);
  overflow: hidden;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 20px 60px rgba(46, 52, 55, 0.22);
  padding: 28px;
}

.confirm-accent {
  position: absolute;
  inset: 0 0 auto 0;
  height: 6px;
  background: linear-gradient(90deg, var(--pink-dark, #d44488), var(--mint, #73d6bf));
}

.confirm-card h2 {
  margin: 0 0 10px 0;
  color: var(--text-dark, #2e3437);
  font-size: 1.3rem;
  line-height: 1.25;
}

.confirm-card p {
  margin: 0;
  color: var(--text-gray, #6b7478);
  line-height: 1.55;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}

.cancel-button,
.confirm-button {
  border: none;
  border-radius: 10px;
  padding: 10px 16px;
  font-weight: 800;
  cursor: pointer;
}

.cancel-button {
  background: var(--mint-bg, #ecfaf6);
  color: var(--mint-darker, #2b8c7b);
}

.confirm-button {
  background: var(--pink-dark, #d44488);
  color: #ffffff;
}

.confirm-button.danger {
  background: #c2415d;
}

@media (max-width: 520px) {
  .confirm-card {
    padding: 24px 18px;
  }

  .confirm-actions {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
