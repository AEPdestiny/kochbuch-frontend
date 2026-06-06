# ADR-013: Kostenlose externe Rezept-API-Integration

## Status

Vorgeschlagen

## Datum

2026-06-06

## Kontext

Dishly Smart besitzt bereits einen Backend-Endpunkt `GET /recipes/external`,
über den externe Rezepte an das Frontend geliefert werden können. Die
bestehende Architektur umfasst:

- Quarkus Backend
- Vue/Vite Frontend
- PostgreSQL
- JWT Auth
- Recipe DTO Layer
- zentrale Recipe API im Frontend
- bestehenden Endpoint `GET /recipes/external`

Für das MVP soll eine kostenlose und möglichst unkomplizierte externe
Rezeptquelle genutzt werden. Spoonacular bietet viele Funktionen, kann aber
durch API-Key-Abhängigkeit, Limits, Pläne oder Kreditkarten-/Account-Themen für
ein Uni-/Demo-Projekt unnötig schwergewichtig sein.

Diese ADR plant die externe Rezept-API-Integration. Es wird keine
Implementierung durchgeführt.

## Anforderungen

Die externe Rezeptquelle soll für das MVP möglichst folgende Anforderungen
erfüllen:

- kostenlos nutzbar
- möglichst ohne Kreditkarte
- für Demo- oder Uni-Projekt geeignet
- Rezeptsuche
- Rezeptdetails
- Bilder
- Zutaten
- Anleitung
- möglichst Nährwerte optional
- einfache REST-Integration
- stabile Beispielantworten für Tests
- kein API-Key im Frontend
- keine Speicherung externer Rezepte im ersten Schritt

## Bewertete API-Kandidaten

### TheMealDB

TheMealDB ist eine frei zugängliche Rezept-/Meal-Datenbank mit REST-Endpunkten
für Suche, Lookup, Kategorien, Bereiche, Zutatenfilter und Bilder. Die
Dokumentation nennt einen frei nutzbaren Entwickler-/Test-Key `1`, der sich gut
für Lernen, Entwicklung und persönliche Projekte eignet.

Geeignete Endpunkte:

- Suche nach Name:
  - `GET https://www.themealdb.com/api/json/v1/1/search.php?s=<name>`
- Rezeptdetails per ID:
  - `GET https://www.themealdb.com/api/json/v1/1/lookup.php?i=<id>`
- zufälliges Rezept:
  - `GET https://www.themealdb.com/api/json/v1/1/random.php`
- Filter nach Kategorie:
  - `GET https://www.themealdb.com/api/json/v1/1/filter.php?c=<category>`
- Kategorien:
  - `GET https://www.themealdb.com/api/json/v1/1/categories.php`

Vorteile:

- sehr niedrige Einstiegshürde
- für Demo-/Uni-Projekte gut geeignet
- Browserfreundliche REST-Endpunkte
- Rezeptbilder vorhanden
- Zutaten und Anleitungen vorhanden
- keine Secrets im MVP nötig, wenn Test-Key `1` verwendet wird
- gutes erstes Ziel für `GET /recipes/external`

Nachteile:

- Daten sind überwiegend Englisch
- Datenqualität und Vollständigkeit variieren
- Nährwerte sind nicht der Fokus
- Zutaten sind in nummerierten Feldern statt als saubere Liste modelliert
- komplexe Filter wie Diät, Allergene oder Makros sind begrenzt

### Spoonacular

Spoonacular ist eine umfangreiche Food-/Recipe-API mit Rezeptsuche,
Nährwertdaten, Diätfiltern, Zutateninformationen und vielen Zusatzfunktionen.

Vorteile:

- sehr umfangreiche Rezept- und Food-Funktionen
- Nährwerte und komplexe Filter möglich
- gute spätere Option für fortgeschrittene Features
- passend für Meal Planning, Nutrition und intelligente Vorschläge

Nachteile:

- API-Key erforderlich
- Limits und Pläne müssen beachtet werden
- Free-Tier kann für Demo reichen, ist aber stärker limitiert
- potenziell Account-/Billing-/Plan-Abhängigkeit
- API-Key darf nicht ins Frontend
- höhere Komplexität für MVP

### Weitere freie Alternativen

Mögliche spätere Alternativen:

- Edamam Recipe API
- API Ninjas Recipe API
- RecipeAPI.io oder ähnliche junge Anbieter
- eigene kuratierte Seed-Datenbank
- Open-Data-/Community-Rezeptsammlungen

Diese Optionen sollten erst geprüft werden, wenn TheMealDB fachlich nicht mehr
ausreicht oder Spoonacular wegen Nährwerten konkret benötigt wird.

## Entscheidung für das MVP

Für das MVP wird TheMealDB als erste externe Rezeptquelle empfohlen.

Begründung:

- TheMealDB ist für Demo- und Lernprojekte unkompliziert nutzbar.
- Es gibt einen einfachen Einstieg mit Test-Key `1`.
- Rezeptbilder, Zutaten und Anleitungen sind vorhanden.
- Die Integration passt gut zum bestehenden `GET /recipes/external`.
- Es werden zunächst keine Secrets und keine Frontend-API-Keys benötigt.
- Die funktionale Tiefe reicht für eine externe Rezeptliste auf der Startseite.

Spoonacular wird nicht verworfen, sondern als spätere Option eingeordnet:

- Nährwerte
- komplexe Filter
- Diät- und Allergieinformationen
- Meal-Planning-Erweiterungen

## Backend-Architektur

Die externe Integration soll backendseitig erfolgen. Das Frontend ruft weiterhin
das eigene Backend auf und kennt keine externen API-Keys.

Geplante Struktur:

```text
recipe/
  external/
    ExternalRecipeClient.java
    ExternalRecipeService.java
    TheMealDbRecipeClient.java
    dto/
      TheMealDbMealResponse.java
      TheMealDbMeal.java
```

Alternativ kann die bestehende `ExternalRecipeService`-Struktur erweitert
werden, ohne das Recipe-Modul groß umzubauen.

### ExternalRecipeClient

Aufgabe:

- HTTP-Aufrufe gegen TheMealDB kapseln
- API-URLs zentral halten
- Timeouts definieren
- Fehler kontrolliert behandeln

Mögliche Methoden:

- `searchByName(String query)`
- `lookupById(String externalId)`
- `randomMeals(int limit)`
- `filterByCategory(String category)`

Für den ersten MVP-Schritt genügt eine kleine Methode, die eine Liste externer
Rezepte liefert.

### ExternalRecipeService

Aufgabe:

- Client-Antworten fachlich aufbereiten
- Mapping auf Dishly-Response ausführen
- Fehlerfälle in kontrollierte Fallbacks übersetzen
- optional Cache nutzen

Der Service sollte keine externen Rezepte dauerhaft speichern.

### Mapping auf RecipeResponse oder eigenes DTO

Es gibt zwei sinnvolle Varianten.

#### Variante A: Mapping auf bestehendes RecipeResponse

Vorteile:

- Frontend kann bestehende Listenlogik weiterverwenden.
- `GET /recipes/external` bleibt kompatibel.
- geringster Aufwand.

Nachteile:

- Externe Rezeptdaten passen nicht perfekt zum internen Recipe-Modell.
- Felder wie `favorite`, `published` oder interne `id` sind fachlich nicht
  echte externe Daten.

#### Variante B: eigenes ExternalRecipeResponse

Vorteile:

- externe Daten werden sauber vom internen Recipe-Modell getrennt.
- Felder wie `source`, `externalId`, `sourceUrl` sind fachlich klarer.
- bessere Basis für spätere Provider-Wechsel.

Nachteile:

- Frontend muss stärker angepasst werden.
- bestehende Recipe-Listenlogik braucht mehr Unterscheidung.

### Empfehlung für das MVP

Für das MVP wird Variante A empfohlen: Mapping auf die bestehende
`RecipeResponse`-Struktur, solange die aktuelle Frontend-Liste damit stabil
funktioniert.

Dabei sollten externe IDs kontrolliert behandelt werden:

- interne Recipe-IDs dürfen nicht mit externen IDs verwechselt werden.
- falls nötig, werden externe IDs als stabile negative oder separate
  stringbasierte Werte behandelt.
- mittelfristig ist `ExternalRecipeResponse` sauberer.

## Fehlerbehandlung bei API-Ausfall

Wenn TheMealDB nicht erreichbar ist, soll Dishly Smart nicht vollständig
fehlschlagen.

Empfohlenes Verhalten:

- Backend setzt kurze HTTP-Timeouts.
- Fehler werden geloggt.
- `GET /recipes/external` liefert entweder:
  - `200 OK` mit leerer Liste, wenn externe Rezepte optional sind, oder
  - `502 Bad Gateway`, wenn der externe Ausfall sichtbar sein soll.

Für das MVP wird empfohlen:

- `200 OK` mit leerer Liste und internem Log für Home-Listenstabilität.
- Optional später: ErrorResponse mit `502`, wenn UI differenzierter damit
  umgehen kann.

## Caching-Idee

Caching reduziert externe Requests und macht die Demo stabiler.

Mögliche Cache-Strategien:

- kurzer In-Memory-Cache im Backend
- Cache pro Suchbegriff
- Cache für zufällige oder populäre Rezepte
- TTL zum Beispiel 15 bis 60 Minuten

Für das MVP:

- kein persistenter Cache nötig
- optional einfacher In-Memory-Cache im Service
- keine PostgreSQL-Speicherung externer Rezepte

Später:

- persistente Cache-Tabelle
- `ExternalRecipeCache`
- Ablaufdatum
- Provider-Metadaten

## Keine Speicherung externer Rezepte im ersten Schritt

Externe Rezepte sollen im ersten Schritt nicht in PostgreSQL gespeichert werden.

Gründe:

- kein Lizenz-/Datenherkunftsrisiko durch Kopieren
- weniger Datenmodell-Komplexität
- kein Konflikt mit User Ownership
- keine Vermischung mit eigenen Rezepten
- geringerer Test- und Migrationsaufwand

Spätere Option:

- User kann externes Rezept als eigenes Rezept importieren.
- Dann wird ein neues internes Recipe erstellt, das dem User gehört.
- Import sollte bewusst und explizit erfolgen.

## Frontend-Auswirkungen

Das Frontend soll zunächst möglichst wenig verändert werden.

Aktueller Zielzustand:

- Home/API-Liste zeigt weiterhin externe Rezepte.
- `recipeApi.getExternalRecipes()` ruft weiter das Backend auf.
- Das Backend entscheidet, welche externe Quelle verwendet wird.
- Externe Daten können zunächst englisch bleiben.

Spätere UI-Erweiterungen:

- Suchfeld für externe Suche nutzen
- externe Rezepte klar kennzeichnen
- Quelle anzeigen, zum Beispiel `Quelle: TheMealDB`
- Detailansicht mit Originalsprache
- Import-Button: `Als eigenes Rezept speichern`

Für den ersten API-Schritt soll keine automatische Übersetzung im Frontend
passieren.

## i18n und deutsche Darstellung

TheMealDB liefert viele Daten auf Englisch. Das ist für den ersten MVP-Schritt
akzeptabel.

Regeln:

- externe Originaldaten bleiben unverändert.
- keine automatische Übersetzung im ersten API-Schritt.
- UI-Texte bleiben Deutsch.
- Rezeptdaten können englisch angezeigt werden.
- ADR-012 wird für spätere Übersetzung berücksichtigt.

Später:

- Übersetzung externer Rezeptdaten über Backend-Service
- Originaldaten und übersetzte Daten getrennt halten
- maschinelle Übersetzungen kennzeichnen
- keine Übersetzung ohne Datenschutz- und Kostenentscheidung

## Datenschutz und Security

Grundregeln:

- API-Keys niemals im Frontend speichern.
- Falls ein Anbieter API-Key benötigt, wird er nur im Backend als Environment
  Variable gesetzt.
- Frontend ruft ausschließlich das eigene Backend auf.
- Externe API-Ausfälle dürfen keine Secrets oder Stacktraces offenlegen.

TheMealDB ist für das MVP bevorzugt, weil der Einstieg mit Test-Key `1` möglich
ist und keine geheimen Frontend-Keys nötig sind.

Falls später Spoonacular genutzt wird:

```text
SPOONACULAR_API_KEY=<secret>
```

Dieser Wert darf nur im Backend gesetzt werden.

## Tests

Backend-Tests:

- `ExternalRecipeClient` mit Mock Response testen.
- Mapping von TheMealDB-Antwort auf `RecipeResponse` testen.
- fehlende Zutatenfelder werden sauber übersprungen.
- leere externe Antwort ergibt leere Liste.
- externer API-Fehler wird kontrolliert behandelt.
- `GET /recipes/external` liefert erwartete Response.
- Resource-Test bleibt ohne echten externen HTTP-Call.

Testfälle:

- TheMealDB liefert ein Rezept mit Bild, Zutaten und Anleitung.
- Service mappt Titel, Bild, Zutaten, Anleitung und Kategorie.
- nicht erreichbare API führt nicht zu Stacktrace beim Client.
- Timeout wird kontrolliert behandelt.

Frontend-Tests:

- `ApiRecipeList.vue` rendert externe Rezepte weiterhin.
- leere externe Liste wird verständlich behandelt.
- Fehlerfall bleibt nutzerfreundlich.

## Risiken

Englische Rezeptdaten:

- TheMealDB-Daten sind häufig Englisch.
- Deutsche UI und englische Rezeptdaten wirken gemischt.
- ADR-012 beschreibt spätere Übersetzung.

API-Limits und Verfügbarkeit:

- Externe API kann ausfallen oder ihr Modell ändern.
- Demo sollte nicht hart davon abhängen.

Datenqualität:

- Zutaten können unvollständig sein.
- Anleitungstexte können unterschiedlich strukturiert sein.
- Kategorien passen nicht immer zum Dishly-Modell.

Nährwerte:

- TheMealDB ist nicht auf Nährwerte fokussiert.
- Für Nutrition-Features ist Spoonacular später besser geeignet.

Lizenz und Datenherkunft:

- Vor persistenter Speicherung oder Import muss geprüft werden, welche Nutzung
  erlaubt ist.

Mapping-Risiken:

- Externe IDs und interne IDs dürfen nicht verwechselt werden.
- `RecipeResponse` ist fachlich eigentlich ein internes Recipe-DTO.
- Ein eigenes `ExternalRecipeResponse` ist langfristig sauberer.

## Schritt-für-Schritt-Plan

1. ADR-013 akzeptieren.
2. TheMealDB als MVP-Quelle festlegen.
3. Backend: `ExternalRecipeClient` oder `TheMealDbRecipeClient` einführen.
4. Backend: HTTP-Aufruf gegen TheMealDB kapseln.
5. Backend: TheMealDB-DTOs für Response-Mapping ergänzen.
6. Backend: Mapping auf bestehendes `RecipeResponse` umsetzen.
7. Backend: `ExternalRecipeService` an echte externe Quelle anbinden.
8. Backend: Fehlerbehandlung bei Timeout oder API-Ausfall ergänzen.
9. Backend: Tests mit Mock Responses schreiben.
10. Backend: `GET /recipes/external` testen.
11. Frontend: bestehende Home/API-Liste per Smoke-Test prüfen.
12. Optional: externe Rezepte sichtbar als extern kennzeichnen.
13. Später: Suchfeld mit externer Suche verbinden.
14. Später: eigenes `ExternalRecipeResponse` prüfen.
15. Später: Spoonacular für Nährwerte und komplexe Filter evaluieren.
16. Später: Übersetzung nach ADR-012 planen.

## Klare MVP-Entscheidung

Für das MVP wird TheMealDB als erste externe Rezeptquelle empfohlen.

Der erste Implementierungsschritt soll klein bleiben:

- Backend ruft TheMealDB auf.
- `GET /recipes/external` bleibt der einzige öffentliche externe Endpoint.
- Frontend nutzt weiter `recipeApi.getExternalRecipes()`.
- externe Rezepte werden nicht gespeichert.
- keine automatische Übersetzung.
- keine Spoonacular-Integration.
- keine Nährwert-Funktion.

## Spätere Optionen

Spoonacular kann später sinnvoll werden für:

- Nährwerte
- Diätfilter
- Allergene
- Makros
- Meal Planning
- Rezept-zu-Einkaufsliste-Logik
- komplexere Suche

Weitere spätere Optionen:

- eigenes `ExternalRecipeResponse`
- externer Rezeptimport als eigenes User-Rezept
- Provider-Abstraktion für mehrere APIs
- persistenter Cache
- Übersetzung externer Rezeptdaten nach ADR-012
- Qualitätsbewertung externer Daten

## Konsequenzen

TheMealDB ermöglicht eine schnelle, kostenlose und demo-taugliche externe
Rezeptintegration, ohne das MVP mit API-Key-Management, Billing-Risiken oder
komplexen Nutrition-Features zu belasten.

Die Entscheidung hält die bestehende Architektur stabil:

- Frontend bleibt gegen das eigene Backend gekoppelt.
- Backend kapselt externe Abhängigkeiten.
- Recipe DTO Layer bleibt nutzbar.
- PostgreSQL bleibt für eigene User-Daten zuständig.
- JWT Auth bleibt unverändert.

## Quellen

- TheMealDB API Guide: https://www.themealdb.com/docs_api_guide.php
- TheMealDB FAQ: https://www.themealdb.com/faq.php
- TheMealDB Website: https://www.themealdb.com/
- Spoonacular API Docs: https://spoonacular.com/food-api/docs
- Spoonacular Pricing: https://spoonacular.com/food-api/pricing
