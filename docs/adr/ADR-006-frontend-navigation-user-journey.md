# ADR-006: Frontend Navigation und User Journey

## Status

Vorgeschlagen

## Datum

2026-06-05

## Kontext

Das Frontend besitzt aktuell eine öffentliche Navigation mit den Bereichen
Home, My Recipes, About und Contact. Das Backend unterstützt inzwischen
Registrierung, Login, `GET /auth/me` und geschützte Recipe-Write-Endpunkte.
Bevor Login- und Register-Views implementiert werden, soll festgelegt werden,
wie sich die Navigation für Gäste und eingeloggte Nutzer verhält.

## Aktuelle Navigation

- Home: öffentliche Startseite mit externen Rezepten, Suche und Shuffle.
- My Recipes: Seite für eigene Rezepte mit CRUD-Funktionen und Favoriten.
- About: öffentliche Informationsseite.
- Contact: öffentliche Kontaktseite.

Aktuell unterscheidet die Navigation noch nicht zwischen Gast und
eingeloggtem User.

## Entscheidungsvorschlag

Die Navigation wird schrittweise auth-fähig gemacht, ohne bestehende Seiten
sofort grundlegend umzubauen.

### Gast-Navigation

Ein nicht eingeloggter Nutzer sieht:

- Home
- My Recipes
- About
- Contact
- Login
- Registrieren

Home, About und Contact bleiben vollständig öffentlich. My Recipes darf
zunächst sichtbar bleiben, muss aber bei schreibenden Aktionen klar auf Login
hinweisen.

### Navigation für eingeloggte Nutzer

Ein eingeloggter Nutzer sieht:

- Home
- My Recipes
- About
- Contact
- Username
- Logout

Login und Registrieren werden für eingeloggte Nutzer ausgeblendet. Der
Username signalisiert den aktuellen Auth-Status. Ein eigenes Profil ist in
diesem Schritt nicht erforderlich.

## Login- und Register-Fluss

- Einstiegspunkt: Header-Aktionen `Login` und `Registrieren`.
- Login erfolgreich: Weiterleitung zur vorher gewünschten Seite, falls
  vorhanden; sonst zu `My Recipes`.
- Registrierung erfolgreich: Weiterleitung zu `My Recipes`, da der User direkt
  eingeloggt wird.
- Logout: Token und User werden aus dem Auth Store entfernt; Weiterleitung zu
  Home.
- Fehlgeschlagener Login oder fehlgeschlagene Registrierung: Formular bleibt
  sichtbar und zeigt die Backend-Fehlermeldung lesbar an.

## Rezept-Funktionen

Öffentlich:

- Rezepte ansehen
- Veröffentlichte Rezepte ansehen
- Einzelnes Rezept ansehen
- Externe Rezepte ansehen

Login erforderlich:

- Rezept erstellen
- Rezept bearbeiten
- Rezept löschen

Die öffentlichen Read-Endpunkte bleiben ohne Token nutzbar. Für
`POST /recipes`, `PUT /recipes/{id}` und `DELETE /recipes/{id}` wird ein
Bearer Token benötigt.

## Header-Konzept

Gast:

- Login
- Registrieren

User:

- Username
- Logout

Der Header soll den Auth-Status knapp und eindeutig zeigen. Es wird kein
größeres Profilmenü eingeführt, solange noch keine Profilseite existiert.

## Route-Konzept

Neue Routen:

- `/login`
- `/register`

Zukünftige geschützte Bereiche:

- `/profile` oder `/me`
- user-bezogene Rezeptlisten
- spätere Fachmodule wie Pantry, ShoppingList oder MealPlan

Route Guards werden erst eingeführt, wenn es tatsächlich geschützte
Frontend-Seiten gibt. Für diesen Schritt reicht es, schreibende Aktionen
innerhalb der bestehenden Seiten auth-bewusst zu behandeln.

## UI-Migrationsplan

1. Login- und Register-Views isoliert anlegen.
2. Header minimal um Auth-Aktionen erweitern.
3. Auth Store beim App-Start initialisieren.
4. My Recipes nicht vollständig umbauen, sondern zuerst nur Create/Edit/Delete
   mit Auth-Status und Authorization Header verbinden.
5. 401- und 403-Fehler in bestehenden Recipe-Flows sichtbar machen.
6. Erst später prüfen, ob My Recipes als ganze Seite einen Route Guard
   bekommen soll.

Dieser Ablauf verhindert einen Big-Bang-Refactor und erhält die bestehenden
Recipe-Ansichten so weit wie möglich.

## Risiken

- My Recipes ist fachlich teilweise privat, bleibt aber vorerst sichtbar. Das
  kann für Nutzer uneindeutig wirken, wenn Schreibaktionen erst beim Klick
  Login verlangen.
- `sessionStorage` schützt nicht gegen XSS. Für das MVP ist es akzeptiert,
  langfristig sollte HttpOnly-Cookie-basierte Auth erneut bewertet werden.
- Bei direkter Weiterleitung nach Login muss der ursprüngliche Zielpfad sauber
  gespeichert werden, ohne offene Redirects zu erlauben.
- Bestehende Fetch-Aufrufe in Recipe-Komponenten können während der
  Migration parallel zum neuen Axios Client existieren.

## Empfehlungen

- Login und Registrierung zuerst als kleine, eigenständige Views umsetzen.
- Header-Anpassung danach separat vornehmen.
- Recipe-Schreiboperationen erst im nächsten Schritt auf den zentralen API
  Client migrieren.
- Öffentliche Read-Funktionen bewusst unverändert lassen.
- Route Guards erst einführen, wenn eine Seite wirklich vollständig
  geschützt werden soll.

## Nicht Teil dieser Entscheidung

- Keine Implementierung von Login/Register Views
- Keine Route Guards
- Keine Frontend-Codeänderungen in diesem Schritt
- Keine Backend-Änderungen
- Keine neuen Fachmodule
