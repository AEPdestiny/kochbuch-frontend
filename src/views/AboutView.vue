<template>
  <section class="about">
    <h1 class="page-title">About Dishly</h1>

    <div class="about-card id-card">
      <div class="id-header">
        <div class="avatar-circle">S</div>
        <div>
          <h2 class="name-title">Salma</h2>
          <p class="name-subtitle">Creator of Dishly</p>
        </div>
      </div>

      <div class="id-body">
        <h3 class="section-title">What is Dishly?</h3>
        <p>
          Dishly is my personal project: a cozy recipe space where simple, tasty dishes are saved in one place.
        </p>

        <h3 class="section-title">What you’ll find here</h3>
        <p>
          Home shows all public recipes. Under “Your recipes” you can create dishes,
          edit or delete them, mark favorites and decide which ones appear on Home.
        </p>

        <h3 class="section-title">Cooking, for me …</h3>
        <p>
          Cooking should be everyday friendly, low‑stress and still a bit special –
          that’s what I want Dishly to feel like.
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.about {
  max-width: 800px;
  margin: 40px auto 60px auto;
  padding: 0 10vw;
}

.page-title {
  font-size: 2.4rem;
  color: #cc7da9;
  margin-bottom: 24px;
}

.about-card.id-card {
  background: #ffffff;
  border-radius: 22px;
  border: 1px solid #c3e7e1;
  box-shadow: 0 4px 22px rgba(79, 127, 120, 0.16);
  padding: 22px 22px 20px 22px;
  position: relative;
}

.about-card.id-card::before {
  content: 'Dishly creator card';
  position: absolute;
  top: 10px;
  right: 18px;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8fd5cc;
}

.id-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
  border-bottom: 1px dashed #c3e7e1;
  padding-bottom: 10px;
}

.avatar-circle {
  width: 52px;
  height: 52px;
  border-radius: 999px;
  background: linear-gradient(135deg, #cc7da9, #8fd5cc);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 800;
  font-size: 1.4rem;
}

.name-title {
  font-size: 1.4rem;
  color: #2b1b23;
  margin: 0;
}

.name-subtitle {
  font-size: 0.9rem;
  color: #486b68;
  margin: 2px 0 0 0;
}

.id-body .section-title {
  font-size: 1.1rem;
  color: #26b6b8;
  margin-top: 14px;
  margin-bottom: 4px;
}

p {
  font-size: 1.05rem;
  line-height: 1.6;
  color: #2b1b23;
}
</style>
