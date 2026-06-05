# ADR-006: Frontend Navigation und User Journey

## Status

Vorgeschlagen

## Datum

2026-06-05

## Kontext

Das Frontend besitzt aktuell eine oeffentliche Navigation mit den Bereichen
Home, My Recipes, About und Contact. Das Backend unterstuetzt inzwischen
Registrierung, Login, `GET /auth/me` und geschuetzte Recipe-Write-Endpunkte.
Bevor Login- und Register-Views implementiert werden, soll festgelegt werden,
wie sich die Navigation fuer Gaeste und eingeloggte Nutzer verhaelt.

## Aktuelle Navigation

- Home: oeffentliche Startseite mit externen Rezepten, Suche und Shuffle.
- My Recipes: Seite fuer eigene Rezepte mit CRUD-Funktionen und Favoriten.
- About: oeffentliche Informationsseite.
- Contact: oeffentliche Kontaktseite.

Aktuell unterscheidet die Navigation noch nicht zwischen Gast und
eingeloggtem User.

## Entscheidungsvorschlag

Die Navigation wird schrittweise auth-faehig gemacht, ohne bestehende Seiten
sofort grundlegend umzubauen.

### Gast-Navigation

Ein nicht eingeloggter Nutzer sieht:

- Home
- My Recipes
- About
- Contact
- Login
- Registrieren

Home, About und Contact bleiben vollstaendig oeffentlich. My Recipes darf
zunaechst sichtbar bleiben, muss aber bei schreibenden Aktionen klar auf Login
hinweisen.

### Navigation fuer eingeloggte Nutzer

Ein eingeloggter Nutzer sieht:

- Home
- My Recipes
- About
- Contact
- Username
- Logout

Login und Registrieren werden fuer eingeloggte Nutzer ausgeblendet. Der
Username signalisiert den aktuellen Auth-Status. Ein eigenes Profil ist in
diesem Schritt nicht erforderlich.

## Login- und Register-Fluss

- Einstiegspunkt: Header-Aktionen `Login` und `Registrieren`.
- Login erfolgreich: Weiterleitung zur vorher gewuenschten Seite, falls
  vorhanden; sonst zu `My Recipes`.
- Registrierung erfolgreich: Weiterleitung zu `My Recipes`, da der User direkt
  eingeloggt wird.
- Logout: Token und User werden aus dem Auth Store entfernt; Weiterleitung zu
  Home.
- Fehlgeschlagener Login oder fehlgeschlagene Registrierung: Formular bleibt
  sichtbar und zeigt die Backend-Fehlermeldung lesbar an.

## Rezept-Funktionen

Oeffentlich:

- Rezepte ansehen
- Veroeffentlichte Rezepte ansehen
- Einzelnes Rezept ansehen
- Externe Rezepte ansehen

Login erforderlich:

- Rezept erstellen
- Rezept bearbeiten
- Rezept loeschen

Die oeffentlichen Read-Endpunkte bleiben ohne Token nutzbar. Fuer
`POST /recipes`, `PUT /recipes/{id}` und `DELETE /recipes/{id}` wird ein
Bearer Token benoetigt.

## Header-Konzept

Gast:

- Login
- Registrieren

User:

- Username
- Logout

Der Header soll den Auth-Status knapp und eindeutig zeigen. Es wird kein
groesseres Profilmenue eingefuehrt, solange noch keine Profilseite existiert.

## Route-Konzept

Neue Routen:

- `/login`
- `/register`

Zukuenftige geschuetzte Bereiche:

- `/profile` oder `/me`
- user-bezogene Rezeptlisten
- spaetere Fachmodule wie Pantry, ShoppingList oder MealPlan

Route Guards werden erst eingefuehrt, wenn es tatsaechlich geschuetzte
Frontend-Seiten gibt. Fuer diesen Schritt reicht es, schreibende Aktionen
innerhalb der bestehenden Seiten auth-bewusst zu behandeln.

## UI-Migrationsplan

1. Login- und Register-Views isoliert anlegen.
2. Header minimal um Auth-Aktionen erweitern.
3. Auth Store beim App-Start initialisieren.
4. My Recipes nicht vollstaendig umbauen, sondern zuerst nur Create/Edit/Delete
   mit Auth-Status und Authorization Header verbinden.
5. 401- und 403-Fehler in bestehenden Recipe-Flows sichtbar machen.
6. Erst spaeter pruefen, ob My Recipes als ganze Seite einen Route Guard
   bekommen soll.

Dieser Ablauf verhindert einen Big-Bang-Refactor und erhaelt die bestehenden
Recipe-Ansichten so weit wie moeglich.

## Risiken

- My Recipes ist fachlich teilweise privat, bleibt aber vorerst sichtbar. Das
  kann fuer Nutzer uneindeutig wirken, wenn Schreibaktionen erst beim Klick
  Login verlangen.
- `sessionStorage` schuetzt nicht gegen XSS. Fuer das MVP ist es akzeptiert,
  langfristig sollte HttpOnly-Cookie-basierte Auth erneut bewertet werden.
- Bei direkter Weiterleitung nach Login muss der urspruengliche Zielpfad sauber
  gespeichert werden, ohne offene Redirects zu erlauben.
- Bestehende Fetch-Aufrufe in Recipe-Komponenten koennen waehrend der
  Migration parallel zum neuen Axios Client existieren.

## Empfehlungen

- Login und Registrierung zuerst als kleine, eigenstaendige Views umsetzen.
- Header-Anpassung danach separat vornehmen.
- Recipe-Schreiboperationen erst im naechsten Schritt auf den zentralen API
  Client migrieren.
- Oeffentliche Read-Funktionen bewusst unveraendert lassen.
- Route Guards erst einfuehren, wenn eine Seite wirklich vollstaendig
  geschuetzt werden soll.

## Nicht Teil dieser Entscheidung

- Keine Implementierung von Login/Register Views
- Keine Route Guards
- Keine Frontend-Codeaenderungen in diesem Schritt
- Keine Backend-Aenderungen
- Keine neuen Fachmodule
