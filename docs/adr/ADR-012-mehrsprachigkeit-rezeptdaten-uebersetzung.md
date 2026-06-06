# ADR-012: Mehrsprachigkeit und Rezeptdaten-Übersetzung

## Status

Vorgeschlagen

## Datum

2026-06-06

## Kontext

Dishly Smart ist aktuell primär deutschsprachig ausgerichtet. Das Frontend zeigt
sichtbare UI-Texte auf Deutsch, API-Endpunkte und technische Bezeichner bleiben
Englisch. Rezeptdaten werden derzeit als fachliche Nutzerdaten gespeichert,
zum Beispiel Titel, Zutaten, Zubereitung, Kategorie und Schwierigkeitsgrad.

Langfristig soll Dishly Smart mehrsprachig nutzbar sein. Dabei gibt es zwei
unterschiedliche Problemfelder:

- UI-Texte der Anwendung müssen übersetzbar sein.
- Rezeptdaten selbst können in mehreren Sprachen vorliegen oder übersetzt
  angezeigt werden.

Diese Entscheidung verändert das aktuelle MVP nicht. Sie beschreibt eine
spätere Architektur für Version 2.

## Ziel

Dishly Smart soll später mehrere Sprachen unterstützen, ohne bestehende
Rezepte, Ownership, Authentifizierung oder aktuelle API-Flows zu beschädigen.

Zu übersetzende Bereiche:

- Navigation, Buttons, Formulare, Fehlermeldungen und Statusmeldungen
- Rezepttitel
- Zutaten
- Zubereitungsschritte
- Kategorien
- Einheiten
- externe Rezeptdaten

Nicht Ziel dieser ADR ist eine sofortige Implementierung.

## Unterschied zwischen UI-i18n und Daten-i18n

### UI-i18n

UI-i18n betrifft feste Anwendungstexte, die vom Projekt kontrolliert werden.

Beispiele:

- `Meine Rezepte`
- `Rezept speichern`
- `Bitte melde dich an`
- `Einkaufsliste`
- `Vorrat`

Diese Texte sind stabil, klein und gut über Sprachdateien verwaltbar.

Eigenschaften:

- technisch im Frontend lösbar
- keine Datenbankmigration für Inhalte nötig
- gut testbar
- klare Schlüssel wie `recipe.save`, `auth.login`, `pantry.empty`

### Daten-i18n

Daten-i18n betrifft Inhalte, die von Nutzern oder externen APIs kommen.

Beispiele:

- Rezepttitel
- Zutatenlisten
- Zubereitungsanleitungen
- Kategorien
- Pantry- oder Shopping-List-Kategorien
- externe Rezeptdaten

Diese Inhalte sind dynamisch, fachlich sensibel und können mehrdeutig sein.
Eine falsche Übersetzung kann ein Rezept unbrauchbar machen, zum Beispiel bei
Mengen, Einheiten oder Kochtechniken.

Eigenschaften:

- benötigt Datenmodell-Entscheidungen
- kann Backend- und Frontend-Änderungen auslösen
- automatische Übersetzung muss kontrolliert werden
- Originaldaten sollten erhalten bleiben

## Entscheidung

Für Version 2 wird eine zweistufige Mehrsprachigkeitsstrategie empfohlen:

1. Frontend-UI-Texte werden mit `vue-i18n` internationalisiert.
2. Rezeptdaten bleiben im Original erhalten und können optional übersetzte
   Varianten erhalten.

Originaldaten werden nie überschrieben. Übersetzungen werden als zusätzliche
Darstellungen gespeichert oder bei Bedarf erzeugt und gecacht.

Für das aktuelle MVP wird keine Mehrsprachigkeit implementiert.

## Vue-i18n für Frontend-Texte

Für UI-Texte wird `vue-i18n` empfohlen.

Geplante Struktur:

```text
src/
  i18n/
    index.ts
    messages/
      de.ts
      en.ts
```

Beispielhafte Schlüssel:

```text
nav.home
nav.myRecipes
auth.login
auth.logout
recipe.createTitle
recipe.save
recipe.loading
pantry.empty
shoppingList.empty
error.network
```

Vorteile:

- etablierte Vue-Integration
- klare Trennung von UI und Logik
- einfache spätere Erweiterung um Englisch oder weitere Sprachen
- Tests können auf Schlüsselverhalten oder gerenderte Sprache prüfen

Empfohlene Startsprachen für Version 2:

- Deutsch (`de`) als bestehende Standardsprache
- Englisch (`en`) als erste zusätzliche Sprache

## Bevorzugte User-Sprache

Für eingeloggte Nutzer sollte später eine bevorzugte Sprache gespeichert
werden.

Mögliche Speicherung:

- Frontend lokal: `localStorage` oder `sessionStorage`
- Backend dauerhaft: Feld am `AppUser`

Empfohlene Version-2-Strategie:

- Für Gäste wird die Sprache lokal im Browser gespeichert.
- Für eingeloggte Nutzer wird die Sprache zusätzlich am `AppUser` gespeichert.

Geplantes Feld:

```text
AppUser.preferredLanguage
```

Beispielwerte:

- `de`
- `en`

Fallback-Regel:

1. Sprache aus User-Profil, falls eingeloggt
2. lokal gespeicherte Sprache im Browser
3. Browser-Sprache, falls unterstützt
4. Default `de`

## Umgang mit externen Rezeptdaten

Externe Rezeptdaten können bereits in einer bestimmten Sprache vorliegen,
häufig Englisch. Diese Daten sollten nicht unkontrolliert verändert werden.

Empfohlene Regeln:

- Externe Originaldaten bleiben unverändert erhalten.
- Die Originalsprache wird gespeichert, falls bekannt.
- Übersetzungen werden getrennt vom Original behandelt.
- Bei fehlender Übersetzung wird das Original angezeigt.

Geplante Metadaten:

- `sourceLanguage`
- `translatedLanguage`
- `translationProvider`
- `translatedAt`

Für externe Rezepte ist besonders wichtig, keine Übersetzung als fachlich
verifizierten Originalinhalt auszugeben.

## Originaldaten vs. übersetzte Daten

Originaldaten sind die fachliche Quelle der Wahrheit.

Übersetzte Daten sind abgeleitete Darstellungen.

Empfohlene Regel:

- Originalfelder bleiben auf der bestehenden `Recipe`-Entity erhalten.
- Übersetzungen werden in einer separaten Struktur gespeichert.
- Eine Übersetzung verweist auf das Originalrezept und eine Sprache.

Vorteile:

- keine Zerstörung bestehender Daten
- mehrere Übersetzungen pro Rezept möglich
- Nutzer kann später Original und Übersetzung vergleichen
- automatische Übersetzungen können ersetzt oder korrigiert werden

## Datenmodell-Erweiterungen

Für Version 2 wird ein separates Übersetzungsmodell empfohlen.

Geplante Entity:

```text
RecipeTranslation
```

Felder:

- `Long id`
- `Recipe recipe`
- `String language`
- `String title`
- `String ingredients`
- `String instructions`
- `String category`
- `String difficulty`
- `String translationProvider`
- `Instant translatedAt`
- `boolean machineTranslated`
- `Instant createdAt`
- `Instant updatedAt`

Constraints:

- Pro Rezept und Sprache sollte es maximal eine aktive Übersetzung geben.
- `recipe_id + language` sollte eindeutig sein.

Optional für später:

- `reviewedByOwner`
- `reviewedAt`
- `qualityScore`

Nicht empfohlen für Version 2:

- bestehende Recipe-Felder direkt durch JSON-Sprachmaps ersetzen
- automatische Übersetzungen als einzige Datenquelle speichern
- Übersetzungen ohne Originalbezug speichern

## Übersetzung von Zutaten, Einheiten und Anleitungen

Zutaten, Einheiten und Anleitungen sind fachlich riskanter als einfache UI-Texte.

### Zutaten

Aktuell sind Zutaten in Rezepten Freitext. Dadurch ist automatische Übersetzung
nicht zuverlässig strukturierbar.

Risiken:

- Zutaten können mehrdeutig sein.
- Mengen und Einheiten können falsch interpretiert werden.
- Kommagetrennte Listen sind nicht immer sauber parsebar.

Empfehlung:

- Für Version 2 zunächst Freitext übersetzen, aber Original anzeigen können.
- Strukturierte Zutaten erst später planen.

### Einheiten

Einheiten sollten nicht blind übersetzt oder umgerechnet werden.

Beispiele:

- `cup` ist nicht automatisch `Tasse`.
- `oz` kann Gewicht oder Volumen bedeuten.
- `EL`, `TL`, `tbsp`, `tsp` brauchen klare Regeln.

Empfehlung:

- Übersetzung und Umrechnung trennen.
- In Version 2 keine automatische Mengenumrechnung einführen.
- Einheitentexte vorsichtig als Text übersetzen.

### Anleitungen

Zubereitungsschritte enthalten oft Kochtechniken und Timing.

Risiken:

- falsche Temperaturangaben
- falsche Garzeiten
- missverständliche Reihenfolge
- Verlust von Warnhinweisen

Empfehlung:

- Automatische Übersetzung klar kennzeichnen.
- Originaltext jederzeit zugänglich lassen.
- Später manuelle Korrektur durch Owner ermöglichen.

## Risiken bei automatischer Übersetzung

Automatische Übersetzung kann nützlich sein, ist aber fachlich nicht neutral.

Risiken:

- falsche Zutaten
- falsche Einheiten
- falsche Mengeninterpretation
- Verlust von Allergie- oder Sicherheitshinweisen
- uneinheitliche Kategorien
- unklare Haftung bei fehlerhaften Kochanweisungen
- Kosten durch API-Nutzung
- Datenschutz bei User-generierten Inhalten
- Latenz bei Live-Übersetzung

Grundsatz:

Automatisch übersetzte Rezeptdaten dürfen nicht als geprüfte Originaldaten
behandelt werden.

## Mögliche APIs und Services für Übersetzung

Mögliche Anbieter:

- DeepL API
- Google Cloud Translation
- Azure AI Translator
- OpenAI API
- LibreTranslate oder selbst gehostete Alternativen

### DeepL

Vorteile:

- sehr gute Qualität für viele europäische Sprachen
- einfache API
- gute Eignung für Fließtexte

Nachteile:

- Kosten und Limits
- Datenschutz und Verarbeitung externer Inhalte prüfen

### Google Cloud Translation

Vorteile:

- sehr viele Sprachen
- robuste Cloud-Plattform

Nachteile:

- Cloud-Kosten
- Einrichtung und Billing-Komplexität

### Azure AI Translator

Vorteile:

- viele Sprachen
- Enterprise-tauglich

Nachteile:

- Plattformbindung
- Kostenmodell prüfen

### OpenAI API

Vorteile:

- kann Kontext berücksichtigen
- kann Küchenbegriffe und Formatierungen flexibler behandeln
- kann Übersetzungen mit Hinweisen oder Struktur erzeugen

Nachteile:

- höhere Komplexität bei Prompting und Qualitätssicherung
- Kosten
- Datenschutzprüfung erforderlich

### LibreTranslate / Self-hosted

Vorteile:

- mehr Kontrolle
- potenziell keine externen Datenweitergaben

Nachteile:

- Qualität kann schwächer sein
- eigener Betrieb und Wartung

## API- und Service-Plan

Für Version 2 sollte Übersetzung backendseitig gesteuert werden, nicht direkt
aus dem Frontend.

Gründe:

- API Keys bleiben im Backend.
- Rate Limits können zentral kontrolliert werden.
- Übersetzungen können gecacht werden.
- Ownership kann geprüft werden.
- Kostenkontrolle ist einfacher.

Mögliche Backend-Struktur:

```text
translation/
  dto/
    RecipeTranslationRequest.java
    RecipeTranslationResponse.java
  entity/
    RecipeTranslation.java
  repository/
    RecipeTranslationRepository.java
  service/
    TranslationService.java
    RecipeTranslationService.java
  resource/
    RecipeTranslationResource.java
```

Mögliche Endpunkte:

- `GET /recipes/{id}/translations/{language}`
- `POST /recipes/{id}/translations`
- `DELETE /recipes/{id}/translations/{language}`

Für öffentliche Rezepte könnten Übersetzungen öffentlich lesbar sein. Für
private Rezepte gelten die bestehenden Ownership-Regeln.

## Frontend-Auswirkungen

Geplante Frontend-Erweiterungen für Version 2:

- `vue-i18n` installieren
- Sprachdateien für UI-Texte anlegen
- Sprachumschalter im Header ergänzen
- Sprache im Auth Store oder eigenem Settings Store halten
- Sprache im User-Profil speichern, falls eingeloggt
- Recipe-Detailansicht kann Original oder Übersetzung anzeigen
- Kennzeichnung bei maschineller Übersetzung
- Fallback auf Originaldaten bei fehlender Übersetzung

Nicht empfohlen:

- alle UI-Texte in einem großen Refactoring gleichzeitig migrieren
- Rezeptdaten im Frontend per externer Übersetzungs-API übersetzen
- API Keys im Frontend speichern

## Sicherheits- und Datenschutzaspekte

Übersetzungsanbieter erhalten potenziell User-generierte Rezeptinhalte.

Zu prüfen:

- Welche Daten werden an externe Anbieter gesendet?
- Sind private Rezepte betroffen?
- Gibt es Einwilligung oder klare Nutzungsbedingungen?
- Werden Inhalte vom Anbieter gespeichert oder zum Training verwendet?
- Wie werden API Keys geschützt?
- Gibt es Rate Limits pro User?

Empfehlung:

- Für private User-Daten keine automatische externe Übersetzung ohne klare
  Datenschutzentscheidung.
- API Keys ausschließlich im Backend.
- Übersetzungen mit Provider und Zeitstempel dokumentieren.

## Teststrategie

### UI-i18n

Tests:

- Default-Sprache ist Deutsch.
- Umschalten auf Englisch ändert sichtbare UI-Texte.
- Fallback greift bei fehlenden Keys.
- Login-/Logout-/Recipe-/Pantry-/Shopping-List-Texte werden aus i18n geladen.

### Daten-i18n

Tests:

- Originalrezept bleibt unverändert.
- Übersetzung wird pro Sprache gespeichert.
- Pro Rezept und Sprache wird keine doppelte aktive Übersetzung erzeugt.
- Private Rezeptübersetzung ist nur für Owner sichtbar.
- Öffentliche Rezeptübersetzung ist öffentlich lesbar, wenn Rezept published ist.
- Fehlende Übersetzung fällt auf Originaldaten zurück.
- Externer Übersetzungsservice wird in Tests gemockt.

### Smoke-Test

- Sprache im Frontend von Deutsch auf Englisch wechseln.
- Registrierung/Login prüfen.
- Rezept erstellen.
- Rezeptübersetzung anfordern.
- Original und Übersetzung vergleichen.
- Private Rezepte bleiben privat.

## Schritt-für-Schritt-Plan für spätere Umsetzung

1. ADR-012 akzeptieren.
2. UI-i18n als eigenständigen Frontend-Schritt planen.
3. `vue-i18n` installieren und Grundstruktur anlegen.
4. Nur Navigation und Auth-Texte auf i18n-Schlüssel umstellen.
5. Tests und Build ausführen.
6. Recipe-, Pantry- und Shopping-List-UI schrittweise auf i18n umstellen.
7. Sprachumschalter ergänzen.
8. Bevorzugte Sprache lokal speichern.
9. Backend-Plan für `AppUser.preferredLanguage` erstellen.
10. `preferredLanguage` am User speichern und über `/auth/me` zurückgeben.
11. Daten-i18n separat planen und Datenmodellmigration vorbereiten.
12. `RecipeTranslation` Entity und Repository einführen.
13. Translation Service mit gemocktem Provider testen.
14. Einen echten Übersetzungsanbieter auswählen.
15. Backend-Env Vars für Übersetzungsanbieter dokumentieren.
16. Übersetzung nur für Owner oder öffentliche Rezepte erlauben.
17. Frontend-Anzeige für Original/Übersetzung ergänzen.
18. Maschinelle Übersetzungen klar kennzeichnen.
19. Production Smoke-Test und Datenschutzprüfung durchführen.

## Klare MVP-Abgrenzung

Nicht Teil des aktuellen MVP:

- keine Installation von `vue-i18n`
- kein Sprachumschalter
- keine Datenbankfelder für User-Sprache
- keine `RecipeTranslation` Entity
- keine automatische Übersetzung
- keine externen Übersetzungs-APIs
- keine Übersetzung bestehender Rezepte
- keine Mengenumrechnung
- keine strukturierten Zutaten
- keine Änderung bestehender API-Endpunkte

Das aktuelle MVP bleibt deutschsprachig und funktional unverändert.

## Empfehlung für Version 2

Empfohlen wird eine klare Reihenfolge:

1. Zuerst UI-i18n mit `vue-i18n`.
2. Danach bevorzugte User-Sprache speichern.
3. Erst danach Rezeptdaten-Übersetzung planen und implementieren.

Für Rezeptdaten wird empfohlen:

- Originaldaten immer behalten.
- Übersetzungen separat speichern.
- automatische Übersetzung als maschinell kennzeichnen.
- externe Provider nur backendseitig anbinden.
- private Rezeptdaten nur nach Datenschutzentscheidung an externe Services
  senden.

Die kleinste sinnvolle Version-2-Ausbaustufe ist:

- Deutsch und Englisch für UI-Texte
- Sprachumschalter
- lokale Sprachspeicherung
- später `AppUser.preferredLanguage`

Rezeptdaten-Übersetzung sollte als eigener größerer Schritt folgen, weil sie
fachlich und rechtlich deutlich riskanter ist als UI-i18n.

## Konsequenzen

Diese Entscheidung trennt klar zwischen Anwendungssprache und Inhaltsübersetzung.
Dadurch kann Dishly Smart mehrsprachig wachsen, ohne das bestehende MVP oder
Nutzerdaten unnötig zu riskieren.

Die Architektur bleibt kompatibel mit:

- Vue 3 und Vite
- Quarkus Backend
- PostgreSQL
- JWT und User Ownership
- bestehenden Recipe-, Pantry- und Shopping-List-Flows

## Offene Fragen

- Welche Sprachen sollen nach Deutsch zuerst unterstützt werden?
- Soll automatische Übersetzung für private Rezepte erlaubt sein?
- Welcher Übersetzungsanbieter passt zu Budget und Datenschutzanforderungen?
- Sollen User maschinelle Übersetzungen manuell korrigieren können?
- Wann werden Zutaten strukturiert statt als Freitext gespeichert?
- Brauchen Kategorien und Einheiten eigene kontrollierte Wörterbücher?
