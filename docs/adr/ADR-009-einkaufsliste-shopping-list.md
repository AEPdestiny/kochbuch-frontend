# ADR-009: Einkaufsliste (Shopping List)

## Status

Vorgeschlagen

## Datum

2026-06-06

## Kontext

Dishly Smart besitzt inzwischen eine JWT-basierte Authentifizierung, persönliche
Rezepte mit Ownership und eine persönliche Vorratsverwaltung (Pantry). Als
nächster fachlicher Schritt soll eine persönliche Einkaufsliste geplant werden.

Die Einkaufsliste soll zur bestehenden Architektur passen:

- Backend: Quarkus, PostgreSQL, Hibernate ORM/Panache, JWT-Security
- Frontend: Vue 3, zentraler Axios `apiClient`, optional Pinia bei wachsender
  Komplexität
- Security: eingeloggter User über Bearer Token
- Ownership: Daten gehören dem aktuellen `AppUser`

Für das MVP soll die Shopping List bewusst klein bleiben. Sie darf Pantry,
Rezepte und spätere MealPlan-Logik nicht zu früh miteinander verkoppeln.

## Ziel

Eingeloggte Nutzer sollen eine persönliche Einkaufsliste pflegen können:

- Einkaufsartikel anzeigen
- Einkaufsartikel manuell hinzufügen
- Einkaufsartikel bearbeiten
- Einkaufsartikel löschen
- Artikel als erledigt markieren

Die Liste ist privat und gehört dem eingeloggten User.

## Bewertete Varianten

### Variante A: Einfache manuelle Einkaufsliste

Der User pflegt Einkaufsartikel manuell. Jeder Eintrag besteht aus Name,
optionaler Menge, optionaler Einheit, optionaler Kategorie und einem Status, ob
der Artikel erledigt ist.

Vorteile:

- sehr klein und MVP-tauglich
- passt zur bestehenden Ownership-Strategie
- unabhängig von Pantry- und Recipe-Datenmodell
- einfach testbar
- geringe fachliche Risiken

Nachteile:

- keine Automatisierung
- Nutzer muss Artikel selbst übertragen

### Variante B: Pantry zu Einkaufsliste übernehmen

Pantry-Einträge können in die Einkaufsliste übernommen werden, zum Beispiel wenn
ein Vorrat leer ist oder nachgekauft werden soll.

Vorteile:

- sinnvoller nächster Schritt nach Pantry
- reduziert manuelle Eingaben
- fachlich gut nachvollziehbar

Nachteile:

- benötigt klare Regeln, wann und wie ein Pantry Item übernommen wird
- Mengen und Einheiten müssen zwischen Pantry und Shopping List sauber
  behandelt werden
- erhöht Kopplung zwischen Pantry und Shopping List
- für das erste MVP nicht zwingend nötig

### Variante C: Rezept zu Einkaufsliste generieren

Aus einem Rezept werden Zutaten automatisch als Einkaufsartikel erzeugt.

Vorteile:

- hoher Nutzwert
- passt langfristig gut zu Dishly Smart
- Grundlage für Meal Planning

Nachteile:

- aktuelle Recipe-Zutaten sind noch Freitext
- Mengen, Einheiten und Zutaten müssten geparst oder strukturiert werden
- hohes Fehlerrisiko bei automatischer Erzeugung
- würde wahrscheinlich neue Datenmodelle oder Parsing-Regeln erzwingen

## Entscheidung

Für das MVP wird Variante A empfohlen: eine einfache manuelle Einkaufsliste.

Begründung:

- Sie ist der kleinste fachlich sinnvolle Schritt.
- Sie nutzt die bestehende JWT- und Ownership-Architektur ohne neue
  Integrationsregeln.
- Pantry und Recipes bleiben unabhängig.
- Die Implementierung ist klein, kontrolliert und testbar.
- Variante B und C bleiben als spätere Erweiterungen möglich.

## Beziehung zur Pantry

Im MVP besteht keine technische Kopplung zwischen Pantry und Shopping List.

Die Beziehung ist zunächst fachlich:

- Pantry beschreibt, was bereits vorhanden ist.
- Shopping List beschreibt, was gekauft werden soll.

Spätere Erweiterungen können sein:

- Pantry Item auf Einkaufsliste übernehmen
- erledigten Einkaufsartikel in Pantry übernehmen
- Mindestbestand in Pantry erkennt Nachkaufbedarf

Diese Erweiterungen werden im MVP bewusst nicht implementiert, damit die
Datenmodelle nicht zu früh voneinander abhängig werden.

## MVP-Funktionen

Die Shopping List soll im MVP folgende Funktionen haben:

- User sieht nur eigene Einkaufsartikel.
- User kann einen Einkaufsartikel anlegen.
- User kann Name, Menge, Einheit und Kategorie pflegen.
- User kann einen Artikel als erledigt markieren.
- User kann einen Artikel bearbeiten.
- User kann einen Artikel löschen.
- Leere Liste wird verständlich angezeigt.
- Ohne Login wird ein Login-Hinweis angezeigt.

Nicht Teil des MVP:

- keine automatische Übernahme aus Pantry
- keine automatische Erzeugung aus Rezepten
- keine MealPlan-Integration
- keine geteilten Listen
- keine Mengenumrechnung
- keine Produktdatenbank
- keine Sortierung nach Supermarktbereichen als Pflichtfunktion

## Minimales Datenmodell

Geplante Entity:

- `ShoppingListItem`

Felder:

- `Long id`
- `String name`
- `BigDecimal quantity`
- `String unit`
- `String category`
- `boolean checked`
- `AppUser owner`
- `Instant createdAt`
- `Instant updatedAt`

Validierung:

- `name` darf nicht leer sein.
- `quantity` ist optional.
- `quantity` muss größer oder gleich `0` sein, falls gesetzt.
- `unit` ist optional.
- `category` ist optional.
- `checked` ist standardmäßig `false`.

Eine separate `ShoppingList`-Entity wird im MVP nicht eingeführt. Jeder User hat
implizit genau eine persönliche Einkaufsliste, dargestellt durch seine
`ShoppingListItem`-Einträge.

## Beziehung zu AppUser

`ShoppingListItem` erhält eine verpflichtende Beziehung zu `AppUser`:

- Feldname: `owner`
- Relation: `@ManyToOne(fetch = FetchType.LAZY)`
- Join-Spalte: `owner_id`
- fachliche Regel: Jeder Einkaufsartikel gehört genau einem User.

Die Beziehung ist nicht nullable. Da Shopping List ein neues Modul ist, müssen
keine ownerlosen Legacy-Daten unterstützt werden.

## REST-Endpunkte

Alle Shopping-List-Endpunkte sind geschützt und benötigen einen gültigen Bearer
Token.

Geplante Endpunkte:

- `GET /shopping-list/items`
- `POST /shopping-list/items`
- `PUT /shopping-list/items/{id}`
- `DELETE /shopping-list/items/{id}`

Optional, aber nicht zwingend für den ersten Schritt:

- `PATCH /shopping-list/items/{id}/checked`

Für das MVP wird empfohlen, den `checked`-Status zunächst über `PUT` zu
aktualisieren. Dadurch bleibt die API kleiner.

Verhalten:

- `GET /shopping-list/items`: listet nur eigene Einkaufsartikel.
- `POST /shopping-list/items`: erstellt einen Artikel für den aktuellen User.
- `PUT /shopping-list/items/{id}`: aktualisiert nur eigene Artikel.
- `DELETE /shopping-list/items/{id}`: löscht nur eigene Artikel.

Fehlerverhalten:

- ohne Token: `401 Unauthorized`
- ungültiger Token: `401 Unauthorized`
- fremder Artikel: `403 Forbidden`
- nicht existierender Artikel: `404 Not Found`
- ungültige Daten: `400 Bad Request`

## DTOs

Geplante DTOs:

- `ShoppingListItemRequest`
- `ShoppingListItemResponse`

`ShoppingListItemRequest`:

- `name`
- `quantity`
- `unit`
- `category`
- `checked`

`ShoppingListItemResponse`:

- `id`
- `name`
- `quantity`
- `unit`
- `category`
- `checked`
- `createdAt`
- `updatedAt`

Owner-Daten werden im MVP nicht in der Response benötigt, da die Liste
ausschließlich persönlich ist.

## Mapper

Ein `ShoppingListItemMapper` wird eingeführt:

- Request zu Entity
- Entity zu Response
- Update-Mapping auf bestehende Entity

Das folgt der bestehenden DTO- und Mapper-Strategie.

## Repository-, Service- und Resource-Struktur

Backend-Zielstruktur:

```text
shopping/
  dto/
    ShoppingListItemRequest.java
    ShoppingListItemResponse.java
  entity/
    ShoppingListItem.java
  mapper/
    ShoppingListItemMapper.java
  repository/
    ShoppingListItemRepository.java
  resource/
    ShoppingListResource.java
  service/
    ShoppingListService.java
```

`ShoppingListItemRepository`:

- erweitert `PanacheRepository<ShoppingListItem>`
- Query nach Owner:
  - `findByOwner(AppUser owner)`

`ShoppingListService`:

- `listMine(currentUser)`
- `create(request, currentUser)`
- `update(id, request, currentUser)`
- `delete(id, currentUser)`

Der Service enthält Ownership-Prüfung und verwendet bestehende Exceptions für
`403` und `404` beziehungsweise eine eigene
`ShoppingListItemNotFoundException`.

`ShoppingListResource`:

- liest den aktuellen User über `UserContext`
- delegiert an den Service
- mappt Entity zu Response
- nutzt `@Valid` für Request-Validierung

## Sicherheitsregeln

Alle Shopping-List-Endpunkte sind geschützt:

- kein öffentlicher Read-Endpunkt
- kein Zugriff ohne Bearer Token
- jeder Request wird auf den aktuellen `AppUser` bezogen
- User darf nur eigene Einkaufsartikel lesen, ändern und löschen
- keine Admin-Logik im MVP

Die bestehende Infrastruktur wird wiederverwendet:

- `UserContext`
- JWT über Bearer Token
- zentrale `ErrorResponse`
- bestehende Mapper für `401`, `403`, `400`, `500`
- eigener NotFound-Mapper für Shopping-List-Items, falls nötig

## Frontend-Auswirkungen

Neue Frontend-Struktur:

```text
src/
  views/
    ShoppingListView.vue
  shared/
    api/
      shoppingListApi.ts
  types/
    shoppingList.ts
```

Geplante UI:

- Route `/shopping-list`
- Login-Hinweis ohne Route Guard
- einfache Liste eigener Einkaufsartikel
- kleines Formular zum Erstellen
- Checkbox oder Button für erledigt
- einfache Edit- und Delete-Aktionen

`shoppingListApi.ts` nutzt den bestehenden `apiClient`, damit der Bearer Token
zentral gesetzt wird.

Geplante API-Funktionen:

- `getShoppingListItems()`
- `createShoppingListItem(request)`
- `updateShoppingListItem(id, request)`
- `deleteShoppingListItem(id)`

Pinia ist im ersten MVP optional. Wenn nur eine View die Einkaufsliste nutzt,
reicht lokaler View-State. Ein Store kann später eingeführt werden, wenn
Shopping List mit Pantry, Recipes oder MealPlan stärker interagiert.

## Teststrategie

Backend-Tests:

- `GET /shopping-list/items` ohne Token gibt `401`.
- `GET /shopping-list/items` mit Token gibt `200`.
- `GET /shopping-list/items` liefert nur eigene Artikel.
- `POST /shopping-list/items` erstellt Artikel für aktuellen User.
- ungültiger Name gibt `400`.
- `PUT` eigenes Item gibt `200`.
- `PUT` fremdes Item gibt `403`.
- `DELETE` eigenes Item gibt `204`.
- `DELETE` fremdes Item gibt `403`.
- unbekannte ID gibt `404`.
- Repository-Integrationstest mit PostgreSQL:
  - speichern
  - nach Owner filtern
  - aktualisieren
  - löschen

Frontend-Tests:

- `shoppingListApi` ruft die korrekten Endpunkte auf.
- View ohne Login zeigt Login-Hinweis und löst keine Backend-Anfrage aus.
- View mit Login lädt Artikel.
- leere Liste wird angezeigt.
- Create-Flow fügt Artikel hinzu.
- Update-Flow aktualisiert Artikel.
- Delete-Flow entfernt Artikel.
- Fehlerfälle für `400`, `401`, `403`, `404` werden verständlich angezeigt.

Manueller Smoke-Test:

- User A erstellt Einkaufsartikel.
- User A markiert Artikel als erledigt.
- User A bearbeitet und löscht Artikel.
- User B sieht Artikel von User A nicht.
- User B kann Artikel von User A nicht per API ändern oder löschen.

## Schritt-für-Schritt-Implementierungsplan

1. ADR-009 akzeptieren.
2. Backend: `ShoppingListItem` Entity mit Owner-Beziehung anlegen.
3. Backend: DTOs und Mapper einführen.
4. Backend: Repository mit `findByOwner(AppUser owner)` anlegen.
5. Backend: Service mit CRUD und Ownership-Regeln implementieren.
6. Backend: Resource mit geschützten Endpunkten ergänzen.
7. Backend: Bean Validation und Fehlerfälle testen.
8. Backend: PostgreSQL-Integrationstest ergänzen.
9. Backend: README um Shopping-List-Endpunkte ergänzen.
10. Frontend: `src/types/shoppingList.ts` anlegen.
11. Frontend: `shared/api/shoppingListApi.ts` anlegen.
12. Frontend: einfache `ShoppingListView.vue` mit Login-Hinweis und Liste bauen.
13. Frontend: Create-Flow ergänzen.
14. Frontend: Checked-/Update-Verhalten ergänzen.
15. Frontend: Delete-Flow ergänzen.
16. Frontend: Tests, Typecheck und Build ausführen.
17. Smoke-Test mit zwei Usern durchführen.

## Risiken

- Zu frühe Integration mit Pantry kann die Datenmodelle unnötig verkoppeln.
- Rezept-zu-Einkaufsliste ist wegen Freitext-Zutaten aktuell fachlich riskant.
- Ohne strukturierte Zutaten können Mengen und Einheiten nicht zuverlässig
  automatisch erzeugt werden.
- Doppelte Einkaufsartikel pro User sind im MVP möglich und zunächst
  akzeptabel.
- Eine spätere Zusammenführung von Pantry und Shopping List braucht klare
  Regeln, damit keine Daten überraschend verschoben oder dupliziert werden.
- Ohne Flyway oder Liquibase bleibt Schema-Entwicklung produktionsnah noch
  unvollständig kontrolliert.

## Empfehlung für das MVP

Empfohlen wird Variante A: einfache manuelle Einkaufsliste.

Das kleinste sinnvolle MVP umfasst:

- Backend-Entity `ShoppingListItem`
- Pflichtfelder: `name`, `owner`
- optionale Felder: `quantity`, `unit`, `category`
- Feld `checked` mit Standardwert `false`
- geschützte Endpunkte:
  - `GET /shopping-list/items`
  - `POST /shopping-list/items`
  - `PUT /shopping-list/items/{id}`
  - `DELETE /shopping-list/items/{id}`
- Frontend-Seite `/shopping-list`
- Login-Hinweis ohne Route Guard
- einfache Liste, Create, Update und Delete

Variante B (Pantry zu Einkaufsliste übernehmen) ist eine sinnvolle spätere
Erweiterung. Variante C (Rezept zu Einkaufsliste generieren) sollte erst
geplant werden, wenn Zutaten strukturiert oder verlässlich parsebar sind.

## Nicht Teil dieser Entscheidung

- Keine Implementierung in diesem Schritt
- Keine Backend-Codeänderungen
- Keine Frontend-Codeänderungen
- Keine Pantry-Integration im MVP
- Keine Rezept-zu-Einkaufsliste-Generierung im MVP
- Keine MealPlan-Integration
- Keine geteilten Einkaufslisten
- Keine Admin-Funktionen
