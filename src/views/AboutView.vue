<script setup lang="ts">
//Bilder importieren
import profileImg from '../assets/salma-profile.jpg'
import food1 from '../assets/food1.jpg'
import food2 from '../assets/food2.jpg'
import food3 from '../assets/food3.jpg'
</script>

<template>
  <!-- About-Seite mit dreispaltigem Layout: Food-Bilder, Text, Portrait -->
  <section class="about">
    <div class="about-layout">
      <!-- Linke Spalte: Bilder von Gerichten -->
      <div class="food-column">
        <div class="food-grid">
          <img :src="food1" alt="Dishly recipe 1" />
          <img :src="food2" alt="Dishly recipe 2" />
          <img :src="food3" alt="Dishly recipe 3" />
        </div>
      </div>

      <!-- Mittlere Spalte: Textkarte mit Erklärung zu Dishly -->
      <div class="intro-column">
        <div class="intro-card">
          <p class="hello-text">Hi, ich bin Salma.</p>
          <h1 class="headline">Die Person hinter Dishly</h1>

          <h2 class="section-title">Was ist Dishly?</h2>
          <p class="intro-body">
            Dishly ist ein digitales Kochbuch, in dem du Rezepte an einem Ort sammelst.
            Es geht um einfache, leckere Gerichte, die du jederzeit wiederfinden kannst,
            damit deine Lieblingsessen nicht in Notizen oder Screenshots verloren gehen.
          </p>

          <h2 class="section-title">Was du hier findest</h2>
          <p class="intro-body">
            Auf der Startseite findest du öffentliche Rezepte, die du durchsuchen und filtern kannst.
            Oben kannst du nach Titel, Kategorie oder Stichwort suchen, um Gerichte schnell zu finden.
            Unter „Meine Rezepte“ kannst du eigene Gerichte erstellen, bearbeiten und löschen,
            Favoriten markieren und auswählen, welche davon auch auf der Startseite erscheinen.
          </p>

          <h2 class="section-title">Kochen bedeutet für mich...</h2>
          <p class="intro-body">
            Kochen soll alltagstauglich, entspannt und trotzdem ein bisschen besonders sein.
            Genau so soll sich Dishly anfühlen.
          </p>
        </div>
      </div>

      <div class="portrait-column">
        <div class="portrait-wrapper">
          <img :src="profileImg" alt="Salma - Erstellerin von Dishly" class="portrait-img" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Gesamtbreite begrenzen und zentrieren */
.about {
  width: 100%;
  max-width: 1200px;
  margin: 40px auto 60px auto;
  padding: 0 6vw;
}

/* Dreispaltiges Grid-Layout für Bilder, Text und Portrait */
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

/* Anpassung für Tablets/Mobile: alles untereinander anzeigen */
@media (max-width: 960px) {
  .about-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .portrait-wrapper {
    margin-top: 16px;
  }
}
</style>
