<script setup lang="ts">
import { useToastStore } from '@/stores/toastStore'

const toastStore = useToastStore()
</script>

<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="toast" tag="div" class="toast-list">
        <div
          v-for="toast in toastStore.toasts"
          :key="toast.id"
          class="toast"
          :class="`toast--${toast.type}`"
          role="alert"
        >
          <span class="toast-message">{{ toast.message }}</span>
          <button
            type="button"
            class="toast-close"
            aria-label="Schließen"
            @click="toastStore.removeToast(toast.id)"
          >
            ×
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 90px;
  right: 28px;
  z-index: 9999;
  pointer-events: none;
}

.toast-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 260px;
  max-width: 380px;
  padding: 14px 18px;
  border-radius: 14px;
  background: var(--text-dark, #2e3437);
  color: #ffffff;
  box-shadow: var(--shadow-pop, 0 16px 48px rgba(46, 52, 55, 0.16));
  font-size: 0.95rem;
  font-weight: 500;
  pointer-events: all;
}

.toast--success {
  background: var(--mint-darker, #2b8c7b);
}

.toast--error {
  background: var(--pink-dark, #d44488);
}

.toast--info {
  background: var(--text-dark, #2e3437);
}

.toast-message {
  flex: 1;
  line-height: 1.4;
}

.toast-close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
  opacity: 0.75;
  padding: 0 2px;
  flex-shrink: 0;
}

.toast-close:hover {
  opacity: 1;
}

/* Enter/leave transitions */
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

@media (max-width: 640px) {
  .toast-container {
    left: 12px;
    right: 12px;
    top: 14px;
  }

  .toast {
    min-width: 0;
    max-width: none;
    width: 100%;
  }
}
</style>
