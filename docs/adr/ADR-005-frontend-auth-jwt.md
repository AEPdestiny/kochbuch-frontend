# ADR-005: Frontend Auth Integration mit JWT

## Status

Akzeptiert

## Datum

2026-06-05

## Kontext

Das Backend stellt JWT-basierte Authentifizierung bereit. Recipe-Write-
Endpunkte benoetigen einen Bearer Token, waehrend Recipe-Read-Endpunkte
oeffentlich bleiben. Das Vue-Frontend nutzt aktuell direkte Fetch-Aufrufe in
Komponenten.

## Entscheidung

Das Frontend erhaelt eine kleine Auth-Infrastruktur:

- Pinia `authStore`
- zentrale Axios-Instanz
- JWT-Speicherung in `sessionStorage`
- vorbereitete Auth-API fuer Registrierung, Login und `/auth/me`
- spaetere Authorization Header fuer geschuetzte Recipe-Write-Requests

Login/Register Views, Navigation und Recipe-Komponenten werden in diesem
Schritt noch nicht geaendert.

## Konsequenzen

- Token-Handling wird zentralisiert.
- Komponenten muessen spaeter keine Header manuell setzen.
- Oeffentliche GET-Endpunkte bleiben ohne Token nutzbar.
- `sessionStorage` ist MVP-tauglich, aber nicht so sicher wie HttpOnly Cookies.

## Nicht Teil dieser Entscheidung

- Keine Refresh Tokens
- Keine Route Guards
- Keine Frontend-UI-Implementierung
- Keine Recipe-Komponenten-Migration in diesem Schritt
