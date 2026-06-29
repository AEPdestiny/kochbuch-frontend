<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  modelValue: string
  suggestions: string[]
  placeholder?: string
  type?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
let blurTimer: ReturnType<typeof setTimeout> | null = null

const filtered = computed(() => {
  const query = props.modelValue.trim().toLowerCase()
  if (!query) return []
  return props.suggestions.filter(s => s.toLowerCase().includes(query)).slice(0, 8)
})

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
  open.value = true
}

function onFocus() {
  if (filtered.value.length > 0) open.value = true
}

function onBlur() {
  // Delay so a click on a suggestion (mousedown) registers before the list closes.
  blurTimer = setTimeout(() => { open.value = false }, 150)
}

function select(value: string) {
  if (blurTimer) clearTimeout(blurTimer)
  emit('update:modelValue', value)
  open.value = false
}
</script>

<template>
  <div class="suggest-input">
    <input
      :value="modelValue"
      :placeholder="placeholder"
      :type="type ?? 'text'"
      autocomplete="off"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
    />
    <ul v-if="open && filtered.length" class="suggest-dropdown" role="listbox">
      <li
        v-for="option in filtered"
        :key="option"
        role="option"
        @mousedown.prevent="select(option)"
      >
        {{ option }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.suggest-input {
  position: relative;
  width: 100%;
}

.suggest-input input {
  width: 100%;
  box-sizing: border-box;
}

.suggest-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 20;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: #ffffff;
  border: 1.5px solid #c3e7e1;
  border-radius: 10px;
  box-shadow: 0 6px 18px rgba(43, 27, 35, 0.16);
  max-height: 220px;
  overflow-y: auto;
}

.suggest-dropdown li {
  padding: 7px 10px;
  border-radius: 7px;
  font-size: 0.92rem;
  color: #2b1b23;
  cursor: pointer;
}

.suggest-dropdown li:hover {
  background: #e0f5f2;
}
</style>
