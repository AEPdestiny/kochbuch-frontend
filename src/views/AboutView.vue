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
  max-width: 1300px;
  margin: 44px auto 64px auto;
  padding: 0 24px;
  box-sizing: border-box;
}

.about-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.2fr) minmax(0, 1.2fr);
  gap: 28px;
  align-items: center;
}


.food-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: 170px;
  gap: 12px;
}

.food-grid img {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-card, 18px);
  object-fit: cover;
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
}

.food-grid img:nth-child(3) {
  grid-column: 1 / span 2;
}


.intro-column {
  position: relative;
}

.intro-card {
  background: var(--pink-bg, #fdf1f5);
  border-radius: var(--radius-card, 18px);
  padding: 28px 26px;
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  position: relative;
  z-index: 1;
}

.hello-text {
  font-family: 'Pacifico', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
  sans-serif;
  font-size: 2.2rem;
  color: var(--pink, #e85a9b);
  font-style: italic;
  margin: 0 0 10px 0;
}

.headline {
  font-size: 1.4rem;
  color: var(--text-gray, #6b7478);
  margin: 4px 0 14px 0;
  font-weight: 700;
}

.section-title {
  font-size: 1.05rem;
  color: var(--mint-darker, #2b8c7b);
  margin-top: 12px;
  margin-bottom: 4px;
}

.intro-body {
  font-size: 1.02rem;
  line-height: 1.7;
  color: var(--text-dark, #2e3437);
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
  border-radius: 24px;
  object-fit: cover;
  box-shadow: var(--shadow-card-hover, 0 12px 32px rgba(61, 174, 155, 0.18));
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

@media (max-width: 640px) {
  .about {
    margin: 24px auto 36px;
    padding: 0 12px;
  }

  .food-grid {
    grid-auto-rows: 130px;
  }

  .intro-card {
    border-radius: 16px;
    padding: 20px 16px;
  }

  .hello-text {
    font-size: 1.8rem;
  }

  .headline {
    font-size: 1.2rem;
    line-height: 1.3;
  }

  .portrait-img {
    border-radius: 18px;
    max-height: 360px;
  }
}
</style>
