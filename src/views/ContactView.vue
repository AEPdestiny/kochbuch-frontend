<template>
  <section class="contact">
    <h1 class="page-title">Contact</h1>

    <div class="contact-card">
      <div class="icon-circle">✉️</div>
      <h2 class="section-title">Get in touch</h2>
      <p>
        Got feedback, ideas or a new feature you would love to see on Dishly?
        i would be happy to hear from you.
      </p>

      <p>
        Just drop a message to
        <a href="mailto:Dishly.Rezepte@gmx.de" class="email-link">
          Dishly.Rezepte@gmx.de
        </a>
        and I’ll get back to you as soon as possible.
      </p>
    </div>
  </section>
</template>

<style scoped>
.contact {
  max-width: 800px;
  margin: 40px auto 60px auto;
  padding: 0 10vw;
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
}

.email-link:hover {
  text-decoration: underline;
}
</style>
