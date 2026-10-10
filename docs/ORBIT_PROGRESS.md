# Orbit progress

Updated 2026-10-10 (Asia/Kolkata).

- **Current milestone:** Collaboration implementation after two security/truthful-controls checkpoints; release remains gated by milestone 1 database validation.
- **Current branch:** `codex/orbit-completion` (branched from `main` at `3872889`).
- **Most recent feature commit:** `51d4ae6 Make meeting password changes atomic and add join prompts` on `codex/orbit-completion` (following `136fd40` and its progress-record commit).
- **Completed and verified this session:** Registered/viewed hourly thread heartbeat. Read Expo SDK 57 reference. Source inventory and initial security review. The first two security/truthful-controls checkpoints were committed and pushed. Current local whiteboard checkpoint adds normalized strokes, participant-scoped durable events, realtime replay, host-only clears, bounded history/rate, and 4 focused ordering/validation tests. TypeScript, lint, web/iOS JavaScript exports, and all 6 unit tests pass. Native hand/reaction, whiteboard synchronization, and SQL changes remain **unverified on backend/devices**.
- **Remaining features:** See the feature inventory in `ORBIT_MASTER_PLAN.md` and per-feature matrix in `ORBIT_TEST_MATRIX.md`. Major gaps include account deletion/edit/recovery, contact removal, whiteboard backend/two-device validation, meeting lifecycle/host controls, notification lifecycle, AI transcript pipeline, real summaries, and platform QA.
- **Open bugs:** High-severity participant-lifecycle finding remains; see `ORBIT_SECURITY_AUDIT.md`. Quota, password, and whiteboard migrations are untested against a database and undeployed. Whiteboard history is intentionally bounded to the latest 500 changes.
- **Tests executed:** `npx tsc --noEmit` PASS; `npm test` PASS (6 tests); `npm run lint` PASS (0 warnings); `npx expo export --platform web` PASS (55 static routes); `npx expo export --platform ios` PASS (Hermes bundle); `xcodebuild` Debug iOS simulator build PASS before the latest JavaScript-only checkpoints. The ad-hoc signed app installed and reached the sign-in screen on the dedicated iOS 26.5 Orbit Test simulator with Metro running after the password UI checkpoint. The unsigned build failed to access Keychain, so signed builds are required for meaningful startup QA. `npx expo install --check` says up to date but used an offline dependency map, so it is inconclusive. No authenticated native journey, database, or two-user test has passed.
- **Environment / credentials:** `.env.local` contains client Supabase variables and is Git-ignored. Connected Supabase app only lists a different project, so Orbit's live database cannot be safely inspected through it. No Docker, Deno, `psql`, or local Postgres executable found; official Supabase CLI is available through `npx` with network escalation. LiveKit/Groq secrets and test accounts have not been verified. Local scheduled work needs the Mac and app running.
- **Exact next implementation task:** Define and enforce meeting participant leave/revocation and lifecycle policy, then validate the quota, password, and whiteboard migrations plus two-account collaboration in an isolated Supabase environment before deployment. If no backend is available, continue account/profile and contact-flow implementation without claiming backend verification.

## Next Codex session

1. Read all six `ORBIT_*.md` files, then inspect `git status`, branch, latest commit, and changed files. Do not assume this note is newer than Git.
2. Check the Goal and heartbeat; avoid a parallel writer and avoid consuming calls during a known exhausted usage window.
3. Resume the exact next task above. Run relevant tests, document actual pass/fail/blocked evidence, review diff for secrets, commit and push a verified checkpoint.
4. Continue subsequent milestones. Do not label production-ready until the definition of done in the mission has evidence.
