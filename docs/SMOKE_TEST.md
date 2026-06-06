# Manueller Smoke-Test

Diese Checkliste beschreibt den aktuellen manuellen End-to-End-Test für Backend
und Frontend. Sie dient als schneller Funktionstest nach lokalen Änderungen.

## 1. Backend starten

Im Backend-Projekt:

```powershell
cd C:\Users\ibrah\IdeaProjects\kochbuch-backend
$env:JWT_SECRET="dev-secret-dev-secret-dev-secret-dev-secret"
$env:JWT_ISSUER="dishly-smart"
.\gradlew.bat quarkusDev
```

Erwartetes Ergebnis:

- Das Backend startet ohne Fehler.
- Die API ist unter `http://localhost:8080` erreichbar.
- Swagger/OpenAPI ist unter `http://localhost:8080/q/swagger-ui` erreichbar.

## 2. Frontend starten

Im Frontend-Projekt:

```powershell
cd C:\Users\ibrah\IdeaProjects\kochbuch-frontend
npm run dev
```

Erwartetes Ergebnis:

- Das Frontend startet ohne Fehler.
- Die Anwendung ist typischerweise unter `http://localhost:5173` erreichbar.

## 3. Registrierung testen

Frontend-URL:

```text
http://localhost:5173/register
```

Beispieldaten für User 1:

```text
Username: salma
Email: salma@example.com
Passwort: supersecret
```

Erwartetes Ergebnis:

- Registrierung ist erfolgreich.
- Der User wird direkt eingeloggt.
- Die Anwendung leitet zur Startseite weiter.
- Ein JWT liegt im `sessionStorage`.

## 4. Login testen

Frontend-URL:

```text
http://localhost:5173/login
```

Beispieldaten:

```text
Email: salma@example.com
Passwort: supersecret
```

Erwartetes Ergebnis:

- Login ist erfolgreich.
- Die Anwendung leitet zur Startseite weiter.
- Der eingeloggte User ist in der Navigation sichtbar.
- Ein JWT liegt im `sessionStorage`.

## 5. `/auth/me` prüfen

Mit Bearer Token aus dem `sessionStorage`:

```http
GET http://localhost:8080/auth/me
Authorization: Bearer <jwt>
```

Erwartetes Ergebnis:

- Mit gültigem Token: `200 OK`
- Die Response enthält den aktuellen User, zum Beispiel:

```json
{
  "id": 1,
  "username": "salma",
  "email": "salma@example.com",
  "role": "USER"
}
```

Gegenprobe ohne Token:

```http
GET http://localhost:8080/auth/me
```

Erwartetes Ergebnis:

- Ohne Token: `401 Unauthorized`

## 6. Rezept erstellen

Frontend-URL:

```text
http://localhost:5173/my-recipes
```

Beispieldaten:

```text
Title: Smoke Test Pasta
Ingredients: noodles, tomato, basil
Instructions: Cook noodles. Add sauce.
Prep time: 10
Cook time: 15
Servings: 2
Difficulty: easy
Category / Cuisine: Italian
Rating: 4.5
Favorite: optional
Show on Home (published): optional
```

Erwartetes Ergebnis:

- Das Rezept wird erfolgreich erstellt.
- Es gibt keinen `401 Unauthorized` oder `403 Forbidden`.
- Das Rezept erscheint in der Liste unter "Your created recipes".

## 7. Meine Rezepte prüfen

Frontend-URL:

```text
http://localhost:5173/my-recipes
```

Erwartetes Ergebnis mit Login:

- Die Seite lädt über `GET /recipes/mine`.
- Nur Rezepte des eingeloggten Users werden angezeigt.
- Das zuvor erstellte Rezept `Smoke Test Pasta` ist sichtbar.

Erwartetes Ergebnis ohne Login:

- Es wird keine Backend-Anfrage für eigene Rezepte ausgelöst.
- Die Seite zeigt den Hinweis:

```text
Bitte melde dich an, um deine Rezepte zu sehen.
```

- Der Link/Button `Zum Login` verweist auf `/login`.

## 8. Zweiten User testen

Ausloggen und anschließend einen zweiten User registrieren:

```text
Username: max
Email: max@example.com
Passwort: supersecret
```

Frontend-URL:

```text
http://localhost:5173/my-recipes
```

Erwartetes Ergebnis:

- User 2 sieht das Rezept `Smoke Test Pasta` von User 1 nicht.
- User 2 sieht nur eigene Rezepte.
- Wenn User 2 ein neues Rezept erstellt, erscheint dieses nur bei User 2 unter
  "Meine Rezepte".

## 9. Ownership für PUT grob testen

Als User 1:

- Eigenes Rezept öffnen.
- Titel ändern, zum Beispiel:

```text
Smoke Test Pasta Updated
```

Erwartetes Ergebnis:

- Update ist erfolgreich.
- Geänderter Titel ist sichtbar.

Als User 2 gegen ein fremdes Rezept per API:

```http
PUT http://localhost:8080/recipes/<fremde-rezept-id>
Authorization: Bearer <jwt-von-user-2>
Content-Type: application/json

{
  "title": "Foreign Update",
  "imageUrl": "",
  "prepTimeMinutes": 10,
  "cookTimeMinutes": 15,
  "servings": 2,
  "difficulty": "easy",
  "category": "Italian",
  "rating": 4.5,
  "ingredients": "noodles, tomato, basil",
  "instructions": "Cook noodles. Add sauce.",
  "favorite": false,
  "published": false
}
```

Erwartetes Ergebnis:

- Fremdes Rezept kann nicht geändert werden.
- Response: `403 Forbidden`

## 10. Ownership für DELETE grob testen

Als User 2 gegen ein fremdes Rezept per API:

```http
DELETE http://localhost:8080/recipes/<fremde-rezept-id>
Authorization: Bearer <jwt-von-user-2>
```

Erwartetes Ergebnis:

- Fremdes Rezept kann nicht gelöscht werden.
- Response: `403 Forbidden`

Als Owner:

```http
DELETE http://localhost:8080/recipes/<eigene-rezept-id>
Authorization: Bearer <jwt-vom-owner>
```

Erwartetes Ergebnis:

- Eigenes Rezept wird gelöscht.
- Response: `204 No Content`
- Das Rezept ist danach unter `http://localhost:5173/my-recipes` nicht mehr sichtbar.

## Pantry CRUD testen

Als User einloggen:

- Mit einem bestehenden User einloggen, zum Beispiel `salma@example.com`.
- Erwartetes Ergebnis: Der User ist eingeloggt und der Navigationspunkt
  `Vorrat` ist sichtbar.

Pantry öffnen:

```text
http://localhost:5173/pantry
```

Pantry Item erstellen:

```text
Name: Tomaten
Menge: 3
Einheit: Stück
Kategorie: Gemüse
```

Erwartetes Ergebnis:

- Klick auf `Hinzufügen` erstellt das Pantry Item.
- `Tomaten` erscheint in der Liste.
- Menge `3`, Einheit `Stück` und Kategorie `Gemüse` sind sichtbar.
- Das Formular wird nach dem Speichern geleert.

Pantry Item bearbeiten:

- Beim Item `Tomaten` auf `Bearbeiten` klicken.
- Werte ändern:

```text
Name: Cherrytomaten
Menge: 5
Einheit: Stück
Kategorie: Gemüse
```

Erwartetes Ergebnis:

- Klick auf `Speichern` aktualisiert das Pantry Item.
- `Cherrytomaten` erscheint in der Liste.
- Menge `5`, Einheit `Stück` und Kategorie `Gemüse` sind sichtbar.
- Der Edit-Modus wird geschlossen.

Pantry Item löschen:

- Beim Item `Cherrytomaten` auf `Löschen` klicken.

Erwartetes Ergebnis:

- Das Pantry Item wird gelöscht.
- `Cherrytomaten` verschwindet aus der Liste.
- Wenn keine weiteren Items vorhanden sind, erscheint:

```text
Dein Vorrat ist noch leer.
```

Ohne Login prüfen:

- Ausloggen.
- `http://localhost:5173/pantry` öffnen.

Erwartetes Ergebnis:

- Es wird keine Pantry-Anfrage an das Backend ausgelöst.
- Die Seite zeigt den Hinweis:

```text
Bitte melde dich an, um deinen Vorrat zu sehen.
```

- Der Link/Button `Zum Login` verweist auf `/login`.
