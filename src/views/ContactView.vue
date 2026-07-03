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
  max-width: 600px;
  margin: 48px auto 64px auto;
  padding: 0 24px;
  width: 100%;
  box-sizing: border-box;
}

.page-title {
  font-size: 2.4rem;
  color: var(--pink-dark, #d44488);
  margin-bottom: 24px;
  text-align: center;
}

.contact-card {
  background: #ffffff;
  border-radius: var(--radius-card, 18px);
  border: 1.5px dashed var(--pink, #e85a9b);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(61, 174, 155, 0.09));
  padding: 40px 32px;
  text-align: center;
}

.icon-circle {
  width: 60px;
  height: 60px;
  border-radius: var(--radius-pill, 999px);
  background: var(--mint-bg, #ecfaf6);
  border: 1.5px solid var(--mint, #5ecbb5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.7rem;
  color: var(--mint-darker, #2b8c7b);
  margin: 0 auto 20px;
}

.section-title {
  font-size: 1.6rem;
  color: var(--pink-dark, #d44488);
  margin-top: 4px;
  margin-bottom: 14px;
}

p {
  font-size: 1.05rem;
  line-height: 1.7;
  color: var(--text-gray, #6b7478);
}

.email-link {
  color: var(--mint-darker, #2b8c7b);
  font-weight: 700;
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
    border-radius: 16px;
    padding: 28px 20px;
  }

  .section-title {
    font-size: 1.3rem;
  }
}
</style>
