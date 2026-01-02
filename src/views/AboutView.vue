<template>
  <section class="about">
    <div class="about-card">
      <h1>Über mich</h1>
      <p>
        Hi, ich bin Salma. Ich bin eine Informatik-Studentin aus Berlin und liebe es zu Kochen.
      </p>
      <p>
        Dishly ist mein persönliches Projekt: eine Rezeptseite, auf der einfache, leckere
        Gerichte übersichtlich gespeichert sind.
      </p>
      <p>
        Die Startseite zeigt alle öffentlichen Rezepte, unter „Deine Rezepte“ kannst du
        eigene Gerichte anlegen, bearbeiten, löschen und als Favorit markieren.
      </p>
      <p>
        Für mich soll Kochen vor allem eins sein: alltagstauglich, stressfrei und trotzdem
        ein bisschen besonders, genau das möchte ich mit Dishly zeigen.
      </p>
    </div>
  </section>
</template>

<style scoped>
.about {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 40px 10vw;
  background: #ffffff;
}
.about-card {
  background: #fff5fb;
  border-radius: 20px;
  padding: 28px 30px;
  max-width: 720px;
  box-shadow: 0 4px 18px rgba(255, 182, 193, 0.25);
  border: 2px solid #ffd6ec;
}
.about-card h1 {
  font-size: 2.1rem;
  color: #e08ab5;
  margin-bottom: 16px;
}
.about-card p {
  font-size: 1.08rem;
  line-height: 1.5;
  color: #5b3b4c;
  margin-bottom: 10px;
}
</style>
