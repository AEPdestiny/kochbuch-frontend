<script setup lang="ts">
import AiChatPanel from '@/components/AiChatPanel.vue'
</script>

<template>
  <section class="ai-page">
    <header class="ai-hero">
      <p class="eyebrow">Dishly AI</p>
      <h1>Persönlicher Küchenassistent</h1>
      <p class="ai-hero-sub">Die Antworten nutzen dein Profil, deinen Vorrat, deinen Wochenplan und deine Favoriten, wenn diese Daten vorhanden sind.</p>
    </header>

    <div class="ai-panel-card">
      <AiChatPanel />
    </div>
  </section>
</template>

<style scoped>
.ai-page {
  box-sizing: border-box;
  color: var(--text-dark, #2e3437);
  display: grid;
  gap: 22px;
  margin: 32px auto 60px;
  max-width: 860px;
  padding: 0 20px;
  width: 100%;
}

.ai-hero {
  background: var(--pink-bg, #fdf1f5);
  border-radius: var(--radius-card, 18px);
  padding: 26px 32px;
}

.eyebrow {
  color: var(--pink, #e85a9b);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  margin: 0 0 8px;
  text-transform: uppercase;
}

.ai-hero h1 {
  color: var(--pink-dark, #d44488);
  font-size: 1.7rem;
  margin: 0 0 8px;
}

.ai-hero-sub {
  color: var(--text-gray, #6b7478);
  font-size: 0.9rem;
  line-height: 1.6;
  margin: 0;
}

.ai-panel-card {
  background: var(--card-bg, #ffffff);
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  padding: 24px 26px;
}

@media (max-width: 640px) {
  .ai-page {
    gap: 16px;
    margin: 18px auto 32px;
    padding: 0 12px;
  }

  .ai-hero {
    padding: 20px 22px;
  }

  .ai-hero h1 {
    font-size: 1.4rem;
    line-height: 1.25;
  }

  .ai-panel-card {
    padding: 18px 16px;
  }
}
</style>
