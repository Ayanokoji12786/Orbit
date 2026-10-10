# Orbit completion plan

Updated 2026-10-10 (Asia/Kolkata). Authoritative work branch: `codex/orbit-completion` in `Ayanokoji12786/Orbit`. Do not run concurrent writers in this checkout. A future run must read this file and `ORBIT_PROGRESS.md`, compare them with Git and source, then take the next unfinished task. The plan is an inventory of work, not a claim of completion.

## Architecture and release rule

Expo SDK 57 / React Native 0.86 / Expo Router client; Supabase Auth, Postgres, Realtime, Storage, and Edge Functions; LiveKit native meeting transport; Groq proxy in `groq-chat`. Public Expo environment variables contain only client credentials. Provider secrets belong in Edge Function environments. The web meeting room is a preview, not a LiveKit call.

Follow the exact [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/) before Expo changes. Recheck current Supabase and LiveKit documentation for their evolving APIs. Do not deploy an untested destructive migration, invent AI output, or claim a feature works from a static code review alone.

## Milestones

1. **Security and truthful controls:** close authorization and rate-limit defects; make visible actions work or communicate unavailability; validate migrations in an isolated database.
2. **Accounts and contact flows:** profile editing, recovery, deletion, contact removal, session states, and two-account authorization tests.
3. **Messaging and meetings:** attachments, offline/reconnect, room lifecycle, password UI, host controls, reliable call recovery, multi-user tests.
4. **Collaboration:** secure synchronized whiteboard, reactions, hand state, polls, screen sharing, real-time tests.
5. **Notifications and AI:** rescheduling/cancellation, notification navigation; consent-gated transcription, notes, summaries, action items, translation, transcript search and context assistance where configured. Otherwise display clear unavailable states.
6. **Release QA:** route-by-route accessibility and platform review, iOS/Android builds and device/simulator journeys, dependency/security audit, documentation, push and PR into `main`.

## Feature inventory from source (not runtime verification)

| Area | Current classification | Evidence / gap |
| --- | --- | --- |
| Email OTP, Google, Apple, session persistence, sign-out | Implemented, unverified | Auth API and screens exist; provider and device checks pending. |
| Account recovery, deletion, profile edit | Missing or UI-only | Edit/profile privacy screens are stubs; no recovery or deletion flow. |
| Contacts and direct chat | Partially implemented | Email lookup, add, favorite, DM and Realtime code exist; remove, reconnection, multi-user tests absent. |
| Image/file attachments | Partial | Private image upload and signed read exist; general files and upload lifecycle are absent. |
| Meeting creation/join/password/LiveKit | Partial | Creation, token issuance and native room exist; password-setting UI, lifecycle and device verification absent. Join link parser added locally. |
| In-call chat and polls | Implemented, unverified | Supabase tables, RLS, subscriptions and UI exist; two-user tests needed. |
| Reactions and Raise Hand | Implemented locally, unverified | LiveKit data/attributes changes on this branch; requires new token function deployment and two-device test. |
| Whiteboard | Local-only | Skia strokes do not synchronize or persist. |
| Screen sharing and participant controls | Partial | Native share attempt exists; no host moderation; web preview now labels native-only controls. |
| Reminders and notifications | Partial | Local reminder scheduling exists; in-app inbox now shows an honest unavailable state; cancel/reschedule/navigation absent. |
| AI assistant | Implemented, unverified | `groq-chat` validates auth/input, rate-limits and proxies Groq; key and end-to-end behavior unverified. It has no meeting audio/transcript context. |
| Summaries, notes, action items, captions, transcription, translation, search | Missing / unavailable | Fabricated home summary and recording content removed; consent and processing pipeline absent. |
| Settings and accessibility | Partial / UI-only | Appearance and accessibility screens exist; privacy and devices are stubs; complete route review pending. |

## Continuation

The Codex Goal was created for this chat; its status should be checked at each continuation because an earlier run reported it blocked. App heartbeat `continue-orbit-development` is registered hourly for this thread. It is a local continuation: this Mac must remain awake with the app running. If a run finds another active writer, another run's dirty checkout, or exhausted usage, it must avoid duplicate work. There is no verified hosted executor for this local checkout. When the mission is truly complete, disable the heartbeat.
