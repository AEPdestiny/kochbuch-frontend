# ADR-005: Frontend Auth Integration mit JWT

## Status

Akzeptiert

## Datum

2026-06-05

## Kontext

Das Backend stellt JWT-basierte Authentifizierung bereit. Recipe-Write-
Endpunkte benötigen einen Bearer Token, während Recipe-Read-Endpunkte
öffentlich bleiben. Das Vue-Frontend nutzt aktuell direkte Fetch-Aufrufe in
Komponenten.

## Entscheidung

Das Frontend erhält eine kleine Auth-Infrastruktur:

- Pinia `authStore`
- zentrale Axios-Instanz
- JWT-Speicherung in `sessionStorage`
- vorbereitete Auth-API für Registrierung, Login und `/auth/me`
- spätere Authorization Header für geschützte Recipe-Write-Requests

Login/Register Views, Navigation und Recipe-Komponenten werden in diesem
Schritt noch nicht geändert.

## Konsequenzen

- Token-Handling wird zentralisiert.
- Komponenten müssen später keine Header manuell setzen.
- Öffentliche GET-Endpunkte bleiben ohne Token nutzbar.
- `sessionStorage` ist MVP-tauglich, aber nicht so sicher wie HttpOnly Cookies.

## Nicht Teil dieser Entscheidung

- Keine Refresh Tokens
- Keine Route Guards
- Keine Frontend-UI-Implementierung
- Keine Recipe-Komponenten-Migration in diesem Schritt
