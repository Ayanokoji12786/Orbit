# Orbit development changelog

## 2026-10-11 — account recovery, staged deletion and AI authorization

- Added a recovery screen for an existing email-code account. Requests avoid creating new users, show the same account-neutral response for unknown addresses, and surface rate-limit or service failures honestly. Six recovery tests pass. Apple and Google users must sign in through their provider; hosted delivery and device behavior remain untested.
- Added typed account-deletion confirmation and a ten-minute fresh sign-in requirement. A new service-role function records a tombstone, closes hosted meetings, removes LiveKit participants/rooms in bounded resumable steps, removes inventoried Storage objects through the Storage API, and deletes the Auth user last. SQL cleans up shared DMs and authored meeting content and blocks new writes during deletion. The client retries 202 responses and offers a retry path, but there is no server-side background continuation; a failed or interrupted deletion can remain pending.
- Restricted the Groq function to active accounts and active meeting participants, replaced caller-provided meeting title with UUID, bounded history, and capped model output. The assistant still has no meeting audio/transcript context.
- All 13 migrations apply in isolated PGlite PostgreSQL 17.5 and `npm test` passes 20/20. TypeScript, lint, web export (57 static routes), iOS JavaScript export, and diff checks pass. Actual hosted Auth/Storage/Edge/LiveKit/Groq, authenticated native journeys and two-account behavior remain unverified. No migration or function was deployed.

## 2026-10-10 — meeting lifecycle, profiles, reminders and SQL tests (`23583ed`)

- Added host-authorized meeting end/cancel, participant leave, expiring membership leases, LiveKit presence renewal, short-lived tokens, and terminal-room checks. Chat, polls, votes, whiteboard and meeting uploads now require active membership; a PostgreSQL test exposed and helped fix guest meeting-image upload denial.
- Added editable display name/bio and private avatar upload, contact favorite/removal, profile display across Home/Settings/LiveKit, and visible sign-out/load errors. Restricted client profile writes to editable columns and made avatar reads path- and contact-scoped.
- Added host rescheduling/cancellation, local reminder replacement/removal, notification-tap navigation, and accurate notification availability text. Signed chat image URLs now expire after five minutes.
- Added a reproducible PGlite harness that applies all 12 local migrations with Supabase schema shims and exercises SQL grants/RLS. `npm test` passes 13/13; TypeScript, fresh lint, web export (55 routes), iOS JavaScript export and diff checks pass.
- These are local code and PostgreSQL results. Hosted Supabase/LiveKit, native notification/avatar behavior, authenticated iOS/Android, and two-device collaboration remain unverified. No migration or Edge Function was deployed.

## 2026-10-10 — shared whiteboard (`cd77b07`)

- Replaced native local-only strokes with normalized coordinates and a participant-scoped Supabase event log. Initial fetch and realtime inserts merge by sequence; late joiners and reconnects replay the same latest 500 changes. Clear is host-only; the web preview stays local.
- Added database-side event validation, a 120 changes/minute per-user bound, 500-event retention, and four passing client merge/validation tests.
- TypeScript, lint, all 6 unit tests, web export, and iOS JavaScript export pass. The SQL migration, authorization policies, live sync, and two-device behavior remain unverified without an isolated Orbit backend.

## 2026-10-10 — password integrity and entry (`51d4ae6`)

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
