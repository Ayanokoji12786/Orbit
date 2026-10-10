# Orbit development changelog

## 2026-10-10 — password integrity and entry (work branch, pending commit)

- Added a host-authorized database operation that writes the password hash and meeting flag in one transaction, plus a guard against direct inconsistent flag changes. The Edge Function validates input and checks the RPC result instead of writing with a service-role client.
- Added host password set/change/removal controls and a guest password prompt for protected native joins. Corrected primary-button text color for the dark theme.
- TypeScript, lint, parser tests, web export, iOS JavaScript export, and signed iOS simulator startup pass. SQL, Edge Function, and two-account behavior remain unverified without an isolated Orbit backend.

## 2026-10-10 — first completion checkpoint (`136fd40`)

- Established a thread Goal and verified an active hourly local heartbeat for continuation.
- Audited source against the mission and created the six durable project records.
- Added a migration that fixes client-resettable rate limits and concurrent first-call counting; made LiveKit token issuance fail closed when quota checks fail.
- Added LiveKit-backed native Raise Hand state and room-wide reactions. Updated meeting token permissions so a participant may update only their own attributes.
- Added strict meeting code/link parsing, wired it into join UI and token fetch, and added two passing parser tests.
- Made the web room an honest visual preview: it no longer mints a LiveKit token or presents simulated media, chat, hand, share, poll, or AI controls as working.
- Removed fabricated home summaries, recordings, and inbox notifications; unavailable states now say what is missing. Constrained AI assistant claims and added malformed-request/key-configuration errors.
- TypeScript, lint (zero warnings), parser tests, web export, and an iOS Debug simulator build pass. The ad-hoc signed build launched to the sign-in screen on the Orbit Test iOS 26.5 simulator. Backend, authenticated/device journeys, and SQL deployment remain unverified.
