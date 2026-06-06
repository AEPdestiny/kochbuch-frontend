# ADR-007: Meine Rezepte und User-zentrierte Rezeptverwaltung

## Status

Vorgeschlagen

## Datum

2026-06-06

## Kontext

Das Frontend besitzt mit `MyRecipesView` eine Seite für die persönliche
Rezeptverwaltung. Diese Seite rendert aktuell die Komponente `RecipeList`.
`RecipeList` lädt die Rezeptdaten über `recipeApi.getRecipes()`, also über
`GET /recipes`.

Das Backend schützt bereits schreibende Recipe-Endpunkte. Neue Rezepte erhalten
einen Owner, und `PUT /recipes/{id}` sowie `DELETE /recipes/{id}` prüfen den
Owner. Für das Lesen der Rezepte nutzt das Frontend aber weiterhin die
öffentliche Gesamtliste.

## Aktueller Zustand

`MyRecipesView` zeigt:

- einen Header mit dem Titel "Your personal Dishly cookbook"
- einen erklärenden Untertitel zum Erstellen, Speichern und Verwalten eigener
  Rezepte
- die Komponente `RecipeList`

`RecipeList` zeigt aktuell:

- Formular zum Erstellen eines Rezepts
- Liste geladener Rezepte
- Edit-Panel für bestehende Rezepte
- Delete-Aktion
- Favoritenbereich

Die geladenen Daten stammen aus `GET /recipes`. Das Frontend nutzt dabei noch
keine User Ownership für die Read-Seite. Ein eingeloggter Nutzer kann dadurch
in `My Recipes` möglicherweise alle Rezepte sehen, nicht nur eigene Rezepte.

## Problem

Die Bezeichnung "My Recipes" verspricht eine user-zentrierte Ansicht. Der
aktuelle Read-Endpunkt `GET /recipes` liefert jedoch eine öffentliche oder
globale Rezeptliste. Ownership wirkt aktuell nur bei Write-Operationen:

- `POST /recipes` setzt den Owner.
- `PUT /recipes/{id}` erlaubt nur Änderungen durch den Owner.
- `DELETE /recipes/{id}` erlaubt nur Löschen durch den Owner.

Für die Anzeige der eigenen Rezepte fehlt ein expliziter owner-bezogener
Read-Flow.

## Lösungswege

### Variante A: Frontend filtert vorhandene Rezepte

Das Frontend lädt weiter `GET /recipes` und filtert anschließend clientseitig
nach Owner.

Voraussetzungen:

- `RecipeResponse` müsste Owner-Informationen enthalten.
- Das Frontend müsste den aktuellen User kennen und mit dem Owner vergleichen.

Bewertung:

- Sicherheit: schwach, da fremde Rezepte weiterhin an den Client ausgeliefert
  werden.
- Performance: schwach bis mittel, da zu viele Daten geladen werden können.
- Wartbarkeit: mittel, weil Ownership-Logik im Frontend dupliziert wird.
- MVP-Tauglichkeit: nur als Übergangslösung geeignet.

### Variante B: Neuer Backend-Endpunkt `GET /recipes/mine`

Das Backend stellt einen geschützten Endpunkt bereit, der nur Rezepte des
eingeloggten Users zurückgibt.

Verhalten:

- `GET /recipes/mine` ohne Token gibt `401 Unauthorized` zurück.
- `GET /recipes/mine` mit gültigem Token gibt nur eigene Rezepte zurück.
- Ownerlose Legacy-Rezepte werden nicht zurückgegeben, außer es wird später
  eine explizite Migrationsregel beschlossen.

Bewertung:

- Sicherheit: stark, da fremde Rezepte nicht ausgeliefert werden.
- Performance: gut, da die Datenbank direkt nach Owner filtern kann.
- Wartbarkeit: gut, weil Ownership-Regeln im Backend bleiben.
- MVP-Tauglichkeit: gut, weil der Endpunkt klein, klar und testbar ist.

### Variante C: `GET /recipes` kontextabhängig machen

`GET /recipes` könnte mit Token nur eigene Rezepte und ohne Token öffentliche
Rezepte liefern.

Bewertung:

- Sicherheit: mittel bis gut, abhängig von der genauen Umsetzung.
- Performance: gut.
- Wartbarkeit: schwächer, da ein Endpunkt zwei Bedeutungen bekommt.
- MVP-Tauglichkeit: riskanter, weil bestehende öffentliche Read-Flows leichter
  unbeabsichtigt verändert werden.

## Entscheidungsvorschlag

Für Dishly Smart passt Variante B am besten: ein neuer geschützter Backend-
Endpunkt `GET /recipes/mine`.

Begründung:

- Die Bedeutung von `My Recipes` wird fachlich korrekt abgebildet.
- Öffentliche Read-Endpunkte bleiben unverändert.
- Ownership-Logik bleibt im Backend und wird nicht im Frontend dupliziert.
- Der Endpunkt ist klein, gut testbar und MVP-tauglich.
- Bestehende Home- und Public-Recipe-Flows bleiben stabil.

## Backend-Plan bei `GET /recipes/mine`

### DTOs

Es sind voraussichtlich keine neuen DTOs nötig.

- Response: bestehendes `RecipeResponse`
- Request: keiner

Falls später Owner-Informationen angezeigt werden sollen, sollte das separat
entschieden werden. Für `My Recipes` reicht zunächst die bestehende
Recipe-Response-Struktur.

### Service-Anpassungen

`RecipeService` erhält eine Methode, die Rezepte für einen bestimmten User lädt.

Geplantes Verhalten:

- aktuellen User über `UserContext` bestimmen
- Repository nach `owner` filtern
- Ergebnis zu `RecipeResponse` mappen

### Repository-Anpassungen

`RecipeRepository` erhält eine Query-Methode für Owner-bezogene Rezepte, zum
Beispiel:

- `findByOwner(AppUser owner)`
- oder eine Panache-Query mit `owner = ?1`

### Resource-Anpassungen

`RecipeResource` erhält:

- `GET /recipes/mine`

Security-Verhalten:

- ohne Token: `401 Unauthorized`
- mit ungültigem Token: `401 Unauthorized`
- mit gültigem Token: `200 OK` mit eigenen Rezepten

### Security-Regeln

`GET /recipes/mine` ist geschützt. Die bestehenden öffentlichen Endpunkte
bleiben öffentlich:

- `GET /recipes`
- `GET /recipes/published`
- `GET /recipes/{id}`
- `GET /recipes/external`

Write-Endpunkte bleiben geschützt:

- `POST /recipes`
- `PUT /recipes/{id}`
- `DELETE /recipes/{id}`

## Frontend-Plan bei `GET /recipes/mine`

`recipeApi` erhält:

- `getMyRecipes()`

`RecipeList` oder eine spätere spezialisierte My-Recipes-Komponente nutzt dann
für `MyRecipesView` nicht mehr `getRecipes()`, sondern `getMyRecipes()`.

Wichtig:

- Home bleibt unverändert.
- Published und external Reads bleiben unverändert.
- Write-Flows bleiben unverändert.
- Ohne Login soll `My Recipes` eine verständliche Login-Meldung zeigen oder
  später per Route Guard geschützt werden.

## Teststrategie

Backend:

- `GET /recipes/mine` ohne Token gibt `401`.
- `GET /recipes/mine` mit gültigem Token gibt `200`.
- User A sieht nur Rezepte von User A.
- User B sieht nur Rezepte von User B.
- Ownerlose Legacy-Rezepte erscheinen nicht in `mine`.
- Öffentliche GET-Endpunkte bleiben weiterhin ohne Token erreichbar.

Frontend:

- `recipeApi.getMyRecipes()` ruft `GET /recipes/mine` auf.
- `MyRecipesView` oder `RecipeList` lädt eigene Rezepte über `getMyRecipes()`.
- Ohne Login wird keine kaputte Anfrage ausgelöst oder eine verständliche
  Meldung angezeigt.
- Bestehende Create/Edit/Delete-Tests bleiben grün.
- Home-Tests bleiben unverändert.

## Risiken

- Bestehende ownerlose Rezepte erscheinen nach der Umstellung nicht mehr in
  `My Recipes`.
- Falls Nutzer bereits globale Rezepte in `My Recipes` erwarten, ändert sich
  die sichtbare Datenmenge.
- Ohne Datenmigration kann es Legacy-Daten geben, die keinem User gehören.
- Route Guards sind noch nicht eingeführt; UX für nicht eingeloggte Nutzer muss
  bewusst gestaltet werden.

## Schritt-für-Schritt-Plan

1. Backend-Endpunkt `GET /recipes/mine` planen und implementieren.
2. Repository-Query nach Owner ergänzen.
3. Service-Methode für eigene Rezepte ergänzen.
4. Resource-Methode mit `UserContext` absichern.
5. Backend-Tests für Auth, Ownership und Legacy-Rezepte ergänzen.
6. Frontend `recipeApi.getMyRecipes()` ergänzen.
7. `MyRecipesView` oder `RecipeList` kontrolliert auf `getMyRecipes()`
   umstellen.
8. Frontend-Tests für eingeloggten und nicht eingeloggten Zustand ergänzen.
9. Danach erst entscheiden, ob `/my-recipes` zusätzlich einen Route Guard
   bekommen soll.

## Nicht Teil dieser Entscheidung

- Keine Implementierung in diesem Schritt
- Keine Backend-Änderungen in diesem Schritt
- Keine Frontend-Änderungen außer dieser Dokumentation
- Keine neuen Fachmodule
- Keine Admin-Logik
