<script setup lang="ts">
import AiChatPanel from '@/components/AiChatPanel.vue'
</script>

<template>
  <section class="ai-page">
    <header>
      <p class="eyebrow">Dishly AI</p>
      <h1>Persönlicher Küchenassistent</h1>
      <p>Die Antworten nutzen dein Profil, deinen Vorrat, deinen Wochenplan und deine Favoriten, wenn diese Daten vorhanden sind.</p>
    </header>

    <AiChatPanel />
  </section>
</template>

<style scoped>
.ai-page {
  color: #243b38;
  display: grid;
  gap: 18px;
  margin: 30px auto 44px;
  max-width: 860px;
  padding: 0 20px;
  width: 100%;
}

.eyebrow {
  color: #2f8f7b;
  font-weight: 800;
  margin: 0 0 6px;
  text-transform: uppercase;
}

h1 {
  color: #cc7da9;
  margin: 0 0 8px;
}
</style>
