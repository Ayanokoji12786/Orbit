# Orbit completion plan

Updated 2026-10-11 (Asia/Kolkata). Authoritative work branch: `codex/orbit-completion` in `Ayanokoji12786/Orbit`. Do not run concurrent writers in this checkout. A future run must read this file and `ORBIT_PROGRESS.md`, compare them with Git and source, then take the next unfinished task. The plan is an inventory of work, not a claim of completion.

## Architecture and release rule

Expo SDK 57 / React Native 0.86 / Expo Router client; Supabase Auth, Postgres, Realtime, Storage, and Edge Functions; LiveKit native meeting transport; Groq proxy in `groq-chat`. Public Expo environment variables contain only client credentials. Provider secrets belong in Edge Function environments. The web meeting room is a preview, not a LiveKit call.

Follow the exact [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/) before Expo changes. Recheck current Supabase and LiveKit documentation for their evolving APIs. Do not deploy an untested destructive migration, invent AI output, or claim a feature works from a static code review alone.

## Milestones

1. **Security and truthful controls:** local quota, password, membership, and Storage changes now pass PGlite PostgreSQL checks; isolated hosted Supabase/LiveKit verification remains.
2. **Accounts and contact flows:** profile edit/private avatar, contact removal, existing-account email OTP recovery, and staged account deletion are implemented locally; hosted Auth/Storage/Edge behavior, deletion retry completion, provider journeys, session states, and two-account authorization remain.
3. **Messaging and meetings:** lifecycle and host end/cancel are implemented locally; attachments, offline/reconnect, host moderation, reliable call recovery, and multi-user tests remain.
4. **Collaboration:** secure synchronized whiteboard, reactions, hand state, polls, screen sharing, real-time tests.
5. **Notifications and AI:** local rescheduling/cancellation and reminder navigation are implemented; cross-device reminder reconciliation and consent-gated transcription, notes, summaries, action items, translation, transcript search, and context assistance remain.
6. **Release QA:** route-by-route accessibility and platform review, iOS/Android builds and device/simulator journeys, dependency/security audit, documentation, push and PR into `main`.

## Feature inventory from source (not runtime verification)

| Area | Current classification | Evidence / gap |
| --- | --- | --- |
| Email OTP, Google, Apple, session persistence, sign-out | Implemented, unverified | Auth API and screens exist; provider and device checks pending. |
| Account recovery, deletion, profile edit | Partial, local implementation | Name/bio/private avatar edit; existing-account email OTP recovery with generic unknown-address response; typed DELETE, ten-minute fresh-session gate, tombstone, bounded LiveKit/Storage cleanup and Auth deletion. No hosted/device deletion or recovery journey; interrupted deletion requires user retry. |
| Contacts and direct chat | Partially implemented | Email lookup, add/remove, favorite, DM and Realtime code exist; reconnect and multi-user tests absent. |
| Image/file attachments | Partial | Private chat images and avatars have signed reads; general files and upload lifecycle are absent. |
| Meeting creation/join/password/LiveKit | Partial | Host end/cancel, leave, 5-minute access leases, 60-second tokens, password controls, and token revocation code exist; hosted/device behavior needs validation and deployment. |
| In-call chat and polls | Implemented, unverified | Supabase tables, RLS, subscriptions and UI exist; two-user tests needed. |
| Reactions and Raise Hand | Implemented locally, unverified | LiveKit data/attributes changes on this branch; requires new token function deployment and two-device test. |
| Whiteboard | Implemented locally, unverified | Normalized participant-scoped events, replay, and host-only clear pass isolated SQL tests; deployment/two-device sync pending. Latest 500 changes retained; web is a local preview. |
| Screen sharing and participant controls | Partial | Native share attempt exists; no host moderation; web preview now labels native-only controls. |
| Reminders and notifications | Partial | Local scheduling, replacement/cancellation, permission handling, and tap navigation exist; device tests, cross-device reconciliation, and in-app inbox remain. |
| AI assistant | Implemented, unverified | `groq-chat` now checks active account and meeting membership, requires meeting UUID, bounds history and output, rate-limits and proxies Groq. Key and end-to-end behavior remain unverified. It has no meeting audio/transcript context. |
| Summaries, notes, action items, captions, transcription, translation, search | Missing / unavailable | Fabricated home summary and recording content removed; consent and processing pipeline absent. |
| Settings and accessibility | Partial | Appearance and accessibility screens exist; Privacy now exposes deletion, while Devices remains a stub. Complete route review pending. |

## Account deletion release gates

The local flow first requires a recently started sign-in session, then records a deletion request before closing write paths. It ends hosted meetings, disconnects LiveKit identities, removes Storage files via the Storage API, and deletes the Auth user last. Repeated calls resume bounded work. The client retries 202 responses within a tap, but there is **no background worker**: a closed app, failed function, or large library leaves a pending request until the user retries. Durable server-side continuation is the next implementation priority. Hosted tests must verify `auth.sessions` access, LiveKit and Storage behavior, Auth cascade, a lost final response, service interruption/retry, and large room/file pagination before this is called reliable. Recheck surviving read access from a still-valid JWT and already-signed URLs. Confirm user-visible handling on iOS, Android, and web.

## Continuation

The Codex Goal is active on this chat as of this checkpoint. App heartbeat `continue-orbit-development` is registered hourly for this thread. It is a local continuation: this Mac must remain awake with the app running. If a run finds another active writer, another run's dirty checkout, or exhausted usage, it must avoid duplicate work. There is no verified hosted executor for this local checkout. When the mission is truly complete, disable the heartbeat.
