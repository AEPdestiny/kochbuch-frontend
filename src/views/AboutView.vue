<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import profileImg from '../assets/dishly-logo.png'
import food1 from '../assets/food1.jpg'
import food2 from '../assets/food2.jpg'
import food3 from '../assets/food3.jpg'

const { t } = useI18n()
</script>

<template>
  <section class="about">
    <div class="about-layout">
      <div class="food-column">
        <div class="food-grid">
          <img :src="food1" alt="Dishly recipe 1" />
          <img :src="food2" alt="Dishly recipe 2" />
          <img :src="food3" alt="Dishly recipe 3" />
        </div>
      </div>

      <div class="intro-column">
        <div class="intro-card">
          <p class="hello-text">{{ t('about.hello') }}</p>
          <h1 class="headline">{{ t('about.headline') }}</h1>

          <h2 class="section-title">{{ t('about.whatTitle') }}</h2>
          <p class="intro-body">{{ t('about.whatBody') }}</p>

          <h2 class="section-title">{{ t('about.findTitle') }}</h2>
          <p class="intro-body">{{ t('about.findBody') }}</p>

          <h2 class="section-title">{{ t('about.cookingTitle') }}</h2>
          <p class="intro-body">{{ t('about.cookingBody') }}</p>
        </div>
      </div>

      <div class="portrait-column">
        <div class="portrait-wrapper">
          <img :src="profileImg" :alt="t('about.profileAlt')" class="portrait-img" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.about {
  width: 100%;
  max-width: 1200px;
  margin: 40px auto 60px auto;
  padding: 0 6vw;
}

.about-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.2fr) minmax(0, 1.2fr);
  gap: 24px;
  align-items: center;
}


.food-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: 170px;
  gap: 10px;
}

.food-grid img {
  width: 100%;
  height: 100%;
  border-radius: 18px;
  object-fit: cover;
  box-shadow: 0 4px 18px rgba(79, 127, 120, 0.18);
}

.food-grid img:nth-child(3) {
  grid-column: 1 / span 2;
}


.intro-column {
  position: relative;
}

.intro-card {
  background: #ffeef6;
  border-radius: 26px;
  padding: 26px 24px 22px 24px;
  box-shadow: 0 6px 24px rgba(191, 140, 167, 0.25);
  border: 1px solid #f6d9ea;
  position: relative;
  z-index: 1;
}

.hello-text {
  font-family: 'Pacifico', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
  sans-serif;
  font-size: 2.2rem;
  color: #cc7da9;
  font-style: italic;
  margin: 0 0 10px 0;
}

.headline {
  font-size: 1.4rem;
  color: #486b68;
  margin: 4px 0 14px 0;
  font-weight: 700;
}

.section-title {
  font-size: 1.05rem;
  color: #26b6b8;
  margin-top: 12px;
  margin-bottom: 4px;
}

.intro-body {
  font-size: 1.02rem;
  line-height: 1.7;
  color: #2b1b23;
  margin-bottom: 10px;
}


.portrait-column {
  position: relative;
}

.portrait-wrapper {
  position: relative;
  z-index: 3;
  margin-top: -40px;
}

.portrait-img {
  width: 100%;
  max-height: 520px;
  border-radius: 30px;
  object-fit: cover;
  box-shadow: 0 12px 32px rgba(79, 127, 120, 0.45);
  border: 3px solid #ffffff;
}

@media (max-width: 960px) {
  .about-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .portrait-wrapper {
    margin-top: 16px;
  }
}
</style>
