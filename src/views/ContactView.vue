<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <section class="contact">
    <h1 class="page-title">{{ t('contact.title') }}</h1>

    <div class="contact-card">
      <div class="icon-circle">✉</div>
      <h2 class="section-title">{{ t('contact.cardTitle') }}</h2>
      <p>
        {{ t('contact.description') }}
      </p>

      <p>
        {{ t('contact.emailIntro') }}
        <a href="mailto:Dishly.Rezepte@gmx.de" class="email-link">
          Dishly.Rezepte@gmx.de
        </a>
        {{ t('contact.emailOutro') }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.contact {
  max-width: 800px;
  margin: 40px auto 60px auto;
  padding: 0 10vw;
  width: 100%;
  box-sizing: border-box;
}

.page-title {
  font-size: 2.4rem;
  color: #cc7da9;
  margin-bottom: 24px;
}

.contact-card {
  background: radial-gradient(circle at top left, #fff7fb, #f4fbfa);
  border-radius: 24px;
  border: 1px solid #f6d9ea;
  box-shadow: 0 4px 22px rgba(191, 140, 167, 0.18);
  padding: 26px 24px 20px 24px;
  text-align: left;
  position: relative;
  overflow: hidden;
}

.contact-card::after {
  content: '';
  position: absolute;
  inset: 6px;
  border-radius: 18px;
  border: 1px dashed rgba(204, 125, 169, 0.35);
  pointer-events: none;
}

.icon-circle {
  width: 54px;
  height: 54px;
  border-radius: 999px;
  background: #ffffff;
  border: 2px solid #8fd5cc;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.7rem;
  color: #26b6b8;
  margin-bottom: 10px;
}

.section-title {
  font-size: 1.6rem;
  color: #cc7da9;
  margin-top: 4px;
  margin-bottom: 10px;
}

p {
  font-size: 1.05rem;
  line-height: 1.6;
  color: #2b1b23;
}

.email-link {
  color: #26b6b8;
  font-weight: 600;
  text-decoration: none;
  overflow-wrap: anywhere;
}

.email-link:hover {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .contact {
    margin: 24px auto 36px;
    padding: 0 12px;
  }

  .page-title {
    font-size: 1.65rem;
    line-height: 1.2;
    margin-bottom: 16px;
  }

  .contact-card {
    border-radius: 18px;
    padding: 22px 16px 18px;
  }

  .section-title {
    font-size: 1.3rem;
  }
}
</style>
