# ADR-008: Vorratsverwaltung (Pantry)

## Status

Vorgeschlagen

## Datum

2026-06-06

## Kontext

Dishly Smart besitzt inzwischen eine JWT-basierte Authentifizierung, eine
User-zentrierte Recipe-Ownership-Strategie und eine persönliche Ansicht für
"Meine Rezepte". Als nächster fachlicher Schritt soll eine persönliche
Vorratsverwaltung entstehen. Nutzer sollen festhalten können, welche Zutaten
oder Lebensmittel sie zu Hause haben.

Die Pantry soll sich in die bestehende Architektur einfügen:

- Backend: Quarkus, PostgreSQL, Hibernate ORM/Panache, JWT-Security
- Frontend: Vue 3, Pinia, zentraler Axios `apiClient`
- Security: eingeloggter User über Bearer Token
- Ownership: Daten gehören dem aktuellen `AppUser`

Die Pantry ist ein neues Fachmodul. Sie soll deshalb klein beginnen und keine
Rezeptlogik, Einkaufslistenlogik oder Meal-Planning-Funktionalität vorwegnehmen.

## Entscheidung

Für das MVP wird eine persönliche Pantry eingeführt, in der jeder eingeloggte
User eigene Vorratseinträge verwalten kann. Pantry-Einträge sind nicht
öffentlich. Jeder Eintrag gehört genau einem `AppUser`.

Das MVP beschränkt sich auf CRUD für Vorräte:

- Vorratseintrag anlegen
- eigene Vorratseinträge auflisten
- Vorratseintrag bearbeiten
- Vorratseintrag löschen

Nicht Teil des MVP:

- keine automatische Rezeptempfehlung anhand der Vorräte
- keine ShoppingList-Integration
- keine MealPlan-Integration
- keine Barcode- oder Produktdatenbank-Integration
- keine geteilten Haushalte
- keine komplexe Mengen- oder Nährwertlogik

## MVP-Funktionen

Die Pantry soll im MVP folgende Funktionen abdecken:

- User sieht nur eigene Vorräte.
- User kann einen Vorratseintrag mit Name und optionaler Menge speichern.
- User kann Kategorie und Einheit optional erfassen.
- User kann ein optionales Mindesthaltbarkeitsdatum erfassen.
- User kann Einträge aktualisieren.
- User kann Einträge löschen.
- User kann eine leere Pantry sehen und daraus neue Einträge anlegen.

Diese Funktionen sind bewusst klein gehalten. Sie schaffen eine stabile Basis,
ohne bereits komplexe Fachlogik für Rezeptvorschläge oder Einkaufslisten zu
erzwingen.

## Zu speichernde Daten

Für das MVP reichen folgende Felder:

- `id`: technische ID
- `name`: Name der Zutat oder des Lebensmittels
- `quantity`: optionale Menge
- `unit`: optionale Einheit, zum Beispiel `g`, `kg`, `ml`, `piece`
- `category`: optionale Kategorie, zum Beispiel `Vegetables`, `Dairy`, `Spices`
- `expiresAt`: optionales Mindesthaltbarkeitsdatum
- `notes`: optionale kurze Notiz
- `owner`: der eingeloggte `AppUser`
- `createdAt`: Erstellzeitpunkt
- `updatedAt`: letzter Änderungszeitpunkt

Für das MVP sollten `name` und `owner` Pflichtfelder sein. Mengenangaben bleiben
zunächst bewusst einfach, damit keine komplexen Einheitenumrechnungen nötig
werden.

## Minimales Datenmodell

Geplante Entity:

- `PantryItem`

Felder:

- `Long id`
- `String name`
- `BigDecimal quantity`
- `String unit`
- `String category`
- `LocalDate expiresAt`
- `String notes`
- `AppUser owner`
- `Instant createdAt`
- `Instant updatedAt`

Validierung:

- `name` darf nicht leer sein.
- `quantity` darf nicht negativ sein, falls gesetzt.
- `notes` kann optional begrenzt werden, zum Beispiel auf 500 Zeichen.

Eine separate `Ingredient`-Entity wird im MVP nicht eingeführt. Dadurch bleibt
das Datenmodell klein und unabhängig von späteren Rezept- oder ShoppingList-
Entscheidungen.

## Beziehung zu AppUser

`PantryItem` erhält eine verpflichtende Many-to-One-Beziehung zu `AppUser`:

- Feldname: `owner`
- Relation: `@ManyToOne(fetch = FetchType.LAZY)`
- Join-Spalte: `owner_id`
- fachliche Regel: Jeder Pantry-Eintrag gehört genau einem User.

Im Unterschied zu `Recipe.owner` sollte `PantryItem.owner` fachlich nicht
nullable sein. Pantry ist ein neues Modul und muss keine ownerlosen Legacy-Daten
unterstützen.

## REST-Endpunkte

Alle Pantry-Endpunkte sind geschützt und benötigen einen gültigen Bearer Token.

Geplante Endpunkte:

- `POST /pantry/items`
- `GET /pantry/items`
- `GET /pantry/items/{id}`
- `PUT /pantry/items/{id}`
- `DELETE /pantry/items/{id}`

Verhalten:

- `POST /pantry/items`: erstellt einen Eintrag für den aktuellen User.
- `GET /pantry/items`: listet nur Einträge des aktuellen Users.
- `GET /pantry/items/{id}`: liefert nur eigene Einträge.
- `PUT /pantry/items/{id}`: aktualisiert nur eigene Einträge.
- `DELETE /pantry/items/{id}`: löscht nur eigene Einträge.

Fehlerverhalten:

- ohne Token: `401 Unauthorized`
- ungültiger Token: `401 Unauthorized`
- fremder Eintrag: `403 Forbidden` oder alternativ bewusst `404 Not Found`
- nicht existierender eigener Eintrag: `404 Not Found`
- ungültige Daten: `400 Bad Request`

Für das MVP wird empfohlen:

- fremder Eintrag bei `GET /pantry/items/{id}`, `PUT` und `DELETE`: `403`
- nicht existierender Eintrag: `404`

Damit bleibt das Verhalten konsistent zur aktuellen Recipe-Ownership-Strategie.

## DTOs

Geplante DTOs:

- `PantryItemRequest`
- `PantryItemResponse`

`PantryItemRequest`:

- `name`
- `quantity`
- `unit`
- `category`
- `expiresAt`
- `notes`

`PantryItemResponse`:

- `id`
- `name`
- `quantity`
- `unit`
- `category`
- `expiresAt`
- `notes`
- `createdAt`
- `updatedAt`

Owner-Daten werden im MVP nicht in der Response benötigt. Der aktuelle User ist
bereits über Auth bekannt, und Pantry-Einträge sind ausschließlich persönlich.

## Mapper

Für die Trennung von API-Modell und Entity wird ein `PantryItemMapper`
eingeführt:

- Request zu Entity
- Entity zu Response
- Update-Mapping auf bestehende Entity

Das folgt der bereits eingeführten DTO-Strategie aus ADR-002.

## Repository- und Service-Struktur

Backend-Zielstruktur:

```text
pantry/
  dto/
    PantryItemRequest.java
    PantryItemResponse.java
  entity/
    PantryItem.java
  mapper/
    PantryItemMapper.java
  repository/
    PantryItemRepository.java
  resource/
    PantryResource.java
  service/
    PantryService.java
```

`PantryItemRepository`:

- erweitert `PanacheRepository<PantryItem>`
- Query nach Owner:
  - `findByOwner(AppUser owner)`
- Query nach ID und Owner, falls sinnvoll:
  - `findByIdAndOwner(Long id, AppUser owner)`

`PantryService`:

- `create(request, currentUser)`
- `findMine(currentUser)`
- `findById(id, currentUser)`
- `update(id, request, currentUser)`
- `delete(id, currentUser)`

Der Service enthält Ownership-Prüfung und fachliche Validierung, soweit diese
nicht bereits über Bean Validation abgedeckt ist.

## Sicherheitsregeln

Alle Pantry-Endpunkte sind geschützt:

- kein öffentlicher Pantry-Read-Endpunkt
- kein Zugriff ohne Bearer Token
- jeder Request wird auf den aktuellen `AppUser` bezogen
- User darf nur eigene Pantry-Einträge lesen, ändern und löschen
- keine Admin-Logik im MVP

Die bestehende Auth-Infrastruktur soll wiederverwendet werden:

- `UserContext` für aktuellen User
- bestehende JWT-Validierung
- bestehende ErrorResponse-Struktur
- bestehende Exception-Mapper für `401`, `403`, `404`, `400`

## Frontend-Auswirkungen

Neue Frontend-Struktur:

```text
src/
  features/
    pantry/
      PantryView.vue
      components/
        PantryItemForm.vue
        PantryItemList.vue
  shared/
    api/
      pantryApi.ts
  types/
    pantry.ts
```

Geplante Frontend-Funktionen:

- neue Route `/pantry`
- Pantry nur sinnvoll mit Login
- ohne Login verständlicher Hinweis mit Link zu `/login`
- Liste eigener Pantry-Einträge
- Formular zum Erstellen
- einfache Edit- und Delete-Aktionen

`pantryApi.ts` nutzt den bestehenden `apiClient`, damit der Bearer Token über
den zentralen Request-Interceptor gesetzt wird.

Geplante API-Funktionen:

- `getPantryItems()`
- `createPantryItem(request)`
- `updatePantryItem(id, request)`
- `deletePantryItem(id)`

Pinia ist für das MVP optional. Falls die Pantry-Seite einfach bleibt, kann sie
zunächst lokal in der View verwaltet werden. Ein `pantryStore` sollte erst
eingeführt werden, wenn mehrere Komponenten oder Seiten denselben Pantry-State
teilen.

## Teststrategie

Backend-Tests:

- Resource-Test: `GET /pantry/items` ohne Token gibt `401`.
- Resource-Test: `GET /pantry/items` mit Token gibt `200`.
- Resource-Test: `POST /pantry/items` erstellt Eintrag für aktuellen User.
- Resource-Test: ungültiger Name gibt `400`.
- Resource-Test: User darf fremden Eintrag nicht lesen, ändern oder löschen.
- Service-Test: Ownership-Regeln.
- Repository-Integrationstest mit PostgreSQL:
  - speichern
  - nach Owner filtern
  - fremde Einträge nicht zurückgeben
  - löschen

Frontend-Tests:

- `pantryApi` ruft die korrekten Endpunkte auf.
- Pantry-Seite ohne Login zeigt Login-Hinweis.
- Pantry-Seite mit Login lädt Einträge.
- Create-Flow fügt Eintrag hinzu.
- Update-Flow aktualisiert Eintrag.
- Delete-Flow entfernt Eintrag.
- Fehlerfälle für `401`, `403`, `404` werden verständlich angezeigt.

Manueller Smoke-Test:

- User A erstellt Pantry-Eintrag.
- User B sieht diesen Eintrag nicht.
- User B kann den Eintrag von User A nicht per API ändern oder löschen.

## Schritt-für-Schritt-Implementierungsplan

1. ADR-008 akzeptieren.
2. Backend: `PantryItem` Entity mit Owner-Beziehung anlegen.
3. Backend: DTOs und Mapper einführen.
4. Backend: `PantryItemRepository` mit Owner-Queries anlegen.
5. Backend: `PantryService` mit CRUD und Ownership-Regeln implementieren.
6. Backend: `PantryResource` mit geschützten Endpunkten ergänzen.
7. Backend: Bean Validation und Fehlerfälle testen.
8. Backend: PostgreSQL-Integrationstest für Pantry ergänzen.
9. Backend: README um Pantry-Endpunkte ergänzen.
10. Frontend: zentrale Typen in `src/types/pantry.ts` anlegen.
11. Frontend: `shared/api/pantryApi.ts` anlegen.
12. Frontend: einfache Pantry-View mit Login-Hinweis und Liste bauen.
13. Frontend: Create-Flow ergänzen.
14. Frontend: Update- und Delete-Flow ergänzen.
15. Frontend: Tests und Build ausführen.
16. Smoke-Test für zwei User durchführen.

## Risiken

- Zu frühe Modellierung von Einheiten kann das MVP unnötig verkomplizieren.
- Pantry kann fachlich schnell mit ShoppingList, MealPlan und Recipe-Matching
  verschwimmen. Diese Integrationen sollten bewusst später entschieden werden.
- Ohne Flyway oder Liquibase bleibt Schema-Entwicklung im lokalen MVP einfach,
  aber für produktionsnahe Umgebungen noch nicht ausreichend kontrolliert.
- Doppelte Pantry-Einträge pro User sind im MVP möglich, falls keine
  Unique-Regel eingeführt wird. Das kann zunächst akzeptiert werden.
- Datumsfelder wie `expiresAt` brauchen im Frontend eine klare Darstellung, um
  Zeitzonen- und Formatierungsprobleme zu vermeiden.

## Empfehlung für ein möglichst kleines MVP

Das kleinste sinnvolle Pantry-MVP besteht aus:

- Backend-Entity `PantryItem`
- Pflichtfelder: `name`, `owner`
- optionale Felder: `quantity`, `unit`, `category`, `expiresAt`, `notes`
- geschützte Endpunkte:
  - `POST /pantry/items`
  - `GET /pantry/items`
  - `PUT /pantry/items/{id}`
  - `DELETE /pantry/items/{id}`
- Frontend-Seite `/pantry`
- Login-Hinweis ohne Route Guard
- einfache Liste und einfaches Formular

`GET /pantry/items/{id}` kann im ersten technischen Schritt optional bleiben,
wenn die UI keine Detailseite benötigt. Für eine saubere REST-Struktur ist der
Endpunkt jedoch sinnvoll und leicht testbar.

## Nicht Teil dieser Entscheidung

- Keine Implementierung in diesem Schritt
- Keine Backend-Codeänderungen
- Keine Frontend-Codeänderungen
- Keine Rezeptempfehlungen anhand der Pantry
- Keine ShoppingList-Integration
- Keine MealPlan-Integration
- Keine Admin-Funktionen
- Keine geteilten Haushalte
