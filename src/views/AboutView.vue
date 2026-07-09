<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import food1 from '../assets/food1.jpg'
import food2 from '../assets/food2.jpg'
import food3 from '../assets/food3.jpg'

const { t } = useI18n()

const featureKeys = ['discover', 'plan', 'pantry'] as const
</script>

<template>
  <section class="about-page">
    <section class="about-hero">
      <div class="hero-copy">
        <h1>{{ t('about.heroTitle') }}</h1>
        <p class="hero-text">{{ t('about.heroBody') }}</p>
      </div>

      <div class="hero-gallery" aria-hidden="true">
        <img :src="food1" alt="" />
        <img :src="food2" alt="" />
        <img :src="food3" alt="" />
      </div>
    </section>

    <section class="feature-grid" :aria-label="t('about.featuresLabel')">
      <article v-for="feature in featureKeys" :key="feature" class="feature-card">
        <span class="feature-marker"></span>
        <h2>{{ t(`about.features.${feature}.title`) }}</h2>
        <p>{{ t(`about.features.${feature}.body`) }}</p>
      </article>
    </section>

    <section class="mission-section">
      <div>
        <p class="eyebrow">{{ t('about.missionEyebrow') }}</p>
        <h2>{{ t('about.missionTitle') }}</h2>
      </div>
      <p>{{ t('about.missionBody') }}</p>
    </section>

    <section class="closing-callout">
      <p>{{ t('about.closing') }}</p>
    </section>
  </section>
</template>

<style scoped>
.about-page {
  box-sizing: border-box;
  display: grid;
  gap: 26px;
  margin: 36px auto 64px;
  max-width: 1180px;
  padding: 0 24px;
  width: 100%;
}

.about-hero {
  align-items: center;
  background: var(--pink-bg, #fdf1f5);
  border-radius: 28px;
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  display: grid;
  gap: 28px;
  grid-template-columns: minmax(0, 1.08fr) minmax(300px, 0.92fr);
  overflow: hidden;
  padding: 42px;
}

.hero-copy {
  display: grid;
  gap: 16px;
  max-width: 640px;
}

.eyebrow {
  color: var(--pink-dark, #d44488);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  margin: 0;
  text-transform: uppercase;
}

.about-hero h1,
.mission-section h2 {
  color: var(--text-dark, #2e3437);
  letter-spacing: 0;
  margin: 0;
}

.about-hero h1 {
  font-size: 3rem;
  line-height: 1.05;
  max-width: 700px;
}

.hero-text,
.mission-section p,
.feature-card p,
.closing-callout p {
  color: var(--text-gray, #6b7478);
  font-size: 1.02rem;
  line-height: 1.7;
  margin: 0;
}

.hero-gallery {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr 1fr;
}

.hero-gallery img {
  aspect-ratio: 1 / 1;
  border: 4px solid #ffffff;
  border-radius: 22px;
  box-shadow: var(--shadow-card-hover, 0 12px 32px rgba(61, 174, 155, 0.18));
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.hero-gallery img:first-child {
  grid-row: span 2;
}

.feature-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.feature-card,
.mission-section,
.closing-callout {
  background: #ffffff;
  border-radius: var(--radius-card, 18px);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
}

.feature-card {
  display: grid;
  gap: 12px;
  padding: 24px;
}

.feature-marker {
  background: var(--mint, #5ecbb5);
  border-radius: var(--radius-pill, 999px);
  display: inline-block;
  height: 8px;
  width: 48px;
}

.feature-card h2 {
  color: var(--pink-dark, #d44488);
  font-size: 1.12rem;
  margin: 0;
}

.mission-section {
  align-items: start;
  display: grid;
  gap: 28px;
  grid-template-columns: 0.85fr 1.15fr;
  padding: 30px;
}

.mission-section h2 {
  font-size: 2rem;
  line-height: 1.15;
  margin-top: 8px;
}

.closing-callout {
  background: var(--mint-bg, #ecfaf6);
  border: 1.5px solid rgba(94, 203, 181, 0.32);
  padding: 22px 26px;
  text-align: center;
}

.closing-callout p {
  color: var(--mint-darker, #2b8c7b);
  font-weight: 800;
}

@media (max-width: 900px) {
  .about-hero,
  .mission-section {
    grid-template-columns: 1fr;
  }

  .about-hero {
    padding: 30px;
  }

  .feature-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .about-page {
    gap: 18px;
    margin: 24px auto 42px;
    padding: 0 12px;
  }

  .about-hero {
    border-radius: 20px;
    padding: 24px 18px;
  }

  .about-hero h1 {
    font-size: 2.1rem;
    line-height: 1.12;
  }

  .hero-gallery {
    gap: 8px;
  }

  .hero-gallery img {
    border-radius: 16px;
  }

  .feature-card,
  .mission-section,
  .closing-callout {
    border-radius: 16px;
    padding: 20px;
  }
}
</style>
