<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string[]
  suggestions?: string[]
  placeholder?: string
  /** Show all suggestions immediately on focus — good for closed lists like allergens. */
  showSuggestionsOnFocus?: boolean
  maxSuggestions?: number
}>(), {
  suggestions: () => [],
  showSuggestionsOnFocus: false,
  maxSuggestions: 8,
})

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const inputText = ref('')
const open = ref(false)
let blurTimer: ReturnType<typeof setTimeout> | null = null

const filteredSuggestions = computed(() => {
  const q = inputText.value.trim().toLowerCase()
  const selected = new Set(props.modelValue.map(t => t.toLowerCase()))
  const candidates = props.suggestions.filter(s => !selected.has(s.toLowerCase()))

  if (!q) {
    return props.showSuggestionsOnFocus ? candidates.slice(0, props.maxSuggestions) : []
  }
  return candidates
    .filter(s => s.toLowerCase().includes(q))
    .slice(0, props.maxSuggestions)
})

function addTag(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return
  if (props.modelValue.some(t => t.toLowerCase() === trimmed.toLowerCase())) return
  emit('update:modelValue', [...props.modelValue, trimmed])
  inputText.value = ''
}

function removeTag(index: number) {
  const next = [...props.modelValue]
  next.splice(index, 1)
  emit('update:modelValue', next)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    if (inputText.value.trim()) {
      addTag(inputText.value)
    }
  } else if (e.key === ',') {
    e.preventDefault()
    addTag(inputText.value)
  } else if (e.key === 'Backspace' && !inputText.value && props.modelValue.length) {
    removeTag(props.modelValue.length - 1)
  }
}

function onInput() {
  open.value = true
}

function onFocus() {
  if (props.showSuggestionsOnFocus || filteredSuggestions.value.length > 0) {
    open.value = true
  }
}

function onBlur() {
  blurTimer = setTimeout(() => { open.value = false }, 150)
}

function selectSuggestion(suggestion: string) {
  if (blurTimer) clearTimeout(blurTimer)
  addTag(suggestion)
  open.value = filteredSuggestions.value.length > 0
}
</script>

<template>
  <div class="tag-input">
    <div class="tag-chips-row" @click="($el as HTMLElement).querySelector('input')?.focus()">
      <span v-for="(tag, index) in modelValue" :key="tag" class="tag-chip">
        {{ tag }}
        <button
          type="button"
          class="tag-chip-remove"
          :aria-label="`${tag} entfernen`"
          @click.stop="removeTag(index)"
        >×</button>
      </span>
      <input
        v-model="inputText"
        class="tag-text-input"
        type="text"
        :placeholder="modelValue.length ? '' : placeholder"
        autocomplete="off"
        @keydown="onKeydown"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
      />
    </div>
    <ul
      v-if="open && filteredSuggestions.length"
      class="tag-suggestions"
      role="listbox"
    >
      <li
        v-for="suggestion in filteredSuggestions"
        :key="suggestion"
        role="option"
        @mousedown.prevent="selectSuggestion(suggestion)"
      >
        {{ suggestion }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.tag-input {
  position: relative;
  width: 100%;
}

.tag-chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 44px;
  border: 1px solid #c7ded8;
  border-radius: 8px;
  padding: 6px 8px;
  cursor: text;
  align-items: center;
  background: #ffffff;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #e0f5f2;
  border: 1px solid #a8d8d2;
  border-radius: 999px;
  padding: 3px 10px 3px 12px;
  font-size: 0.88rem;
  font-weight: 600;
  color: #1d5c5d;
  white-space: nowrap;
}

.tag-chip-remove {
  background: none;
  border: none;
  color: #486b68;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  padding: 0 2px;
  min-width: 20px;
  min-height: 20px;
  opacity: 0.7;
}

.tag-chip-remove:hover {
  opacity: 1;
  color: #a14c2b;
}

.tag-text-input {
  border: none;
  outline: none;
  flex: 1;
  min-width: 100px;
  font: inherit;
  font-size: 0.95rem;
  background: transparent;
  padding: 3px 4px;
}

.tag-suggestions {
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
  box-shadow: 0 6px 18px rgba(43, 27, 35, 0.14);
  max-height: 240px;
  overflow-y: auto;
}

.tag-suggestions li {
  padding: 7px 10px;
  border-radius: 7px;
  font-size: 0.92rem;
  color: #2b1b23;
  cursor: pointer;
}

.tag-suggestions li:hover {
  background: #e0f5f2;
}
</style>
