<template>
  <section class="contact">
    <div class="contact-card">
      <h1>Kontaktiere uns</h1>
      <p>
        Haben Sie eine Nachricht, Idee oder Verbesserung für Dishly?
        Wir lieben es, von Ihnen zu hören.
      </p>
      <p class="email-line">
        Schreiben Sie uns jederzeit an
        <a href="mailto:Dishly.Rezepte@gmx.de" class="email-link">
          Dishly.Rezepte@gmx.de
        </a>.
      </p>
    </div>
  </section>
</template>

<style scoped>
.contact {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 40px 10vw;
  background: #ffffff;
}
.contact-card {
  background: #fff5fb;
  border-radius: 20px;
  padding: 28px 30px;
  max-width: 720px;
  box-shadow: 0 4px 18px rgba(255, 182, 193, 0.25);
  border: 2px solid #ffd6ec;
}
h1 {
  font-size: 2.1rem;
  color: #e08ab5;
  margin-bottom: 16px;
}
p {
  font-size: 1.05rem;
  line-height: 1.5;
  color: #5b3b4c;
  margin-bottom: 10px;
}
.email-line {
  margin-top: 6px;
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
