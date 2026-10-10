# Orbit progress

Updated 2026-10-10 (Asia/Kolkata).

- **Current milestone:** Security, account, and meeting lifecycle implementation is locally verified; hosted backend and two-device validation remain release gates.
- **Current branch:** `codex/orbit-completion` (branched from `main` at `3872889`).
- **Most recent feature commit:** `23583ed Secure meeting lifecycle and complete profile and reminder flows` on `codex/orbit-completion`.
- **Completed and verified this session:** Added host-authorized end/cancel, participant leave, expiring membership leases, LiveKit presence renewal, terminal token checks, and RLS revocation for meeting content. Added profile edit and private avatar upload, contact favorite/removal, sign-out error handling, rescheduling/cancellation, and local reminder replacement/navigation. A reproducible PGlite PostgreSQL 17.5 harness applies all 12 migrations and tests real grants/RLS, including a guest meeting-image upload defect it exposed and we fixed. `npm test` passes 13/13; TypeScript, lint, web export (55 routes), iOS JavaScript export, and diff checks pass. Hosted Edge Functions, LiveKit revocation, native notification behavior, Realtime, and two-device collaboration remain **unverified**.
- **Remaining features:** See `ORBIT_MASTER_PLAN.md` and `ORBIT_TEST_MATRIX.md`. Major gaps include account recovery/deletion, general file attachments, offline/reconnect behavior, host moderation, AI transcript/summary pipeline, route-by-route accessibility, authenticated iOS/Android and two-user validation, and safe deployment.
- **Open risks:** All 12 SQL migrations pass isolated PostgreSQL tests but are undeployed. An already-issued private image URL can remain usable for up to five minutes after meeting access ends. Reminders are local to the device that schedules them; cross-device changes do not reconcile old reminders. LiveKit Cloud token revocation and native room behavior are unverified. Whiteboard history remains capped at 500 changes.
- **Tests executed:** `npm test` PASS (13 tests, including PGlite migration/RLS tests); `npx tsc --noEmit` PASS; `npx expo lint --no-cache` PASS; `npx expo export --platform web` PASS (55 routes); `npx expo export --platform ios` PASS; `git diff --check` PASS. Earlier signed iOS Debug simulator build reached sign-in before this checkpoint; no new native binary build or authenticated journey was run. Android, hosted backend, and two-user tests remain blocked.
- **Environment / credentials:** `.env.local` contains client Supabase variables and is Git-ignored. The connected Supabase app lists only an unrelated project; no Orbit migration/function was deployed. PGlite is a test-only local Postgres runtime with Supabase schema shims. Docker/Deno/local Supabase services are unavailable. LiveKit/Groq secrets and isolated test accounts remain unverified. Local scheduled work needs the Mac and app running.
- **Exact next implementation task:** Implement and test account recovery/deletion and data cleanup without weakening RLS. In parallel when an isolated Orbit Supabase project is available, deploy migrations/functions there and run two-account meeting, chat, poll, whiteboard, avatar, reminder, and lifecycle tests before any production deployment.

## Next Codex session

1. Read all six `ORBIT_*.md` files, then inspect `git status`, branch, latest commit, and changed files. Do not assume this note is newer than Git.
2. Check the Goal and heartbeat; avoid a parallel writer and avoid consuming calls during a known exhausted usage window.
3. Resume the exact next task above. Run relevant tests, document actual pass/fail/blocked evidence, review diff for secrets, commit and push a verified checkpoint.
4. Continue subsequent milestones. Do not label production-ready until the definition of done in the mission has evidence.
