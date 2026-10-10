# Orbit progress

Updated 2026-10-10 (Asia/Kolkata).

- **Current milestone:** Security and truthful controls, milestone 1 of `ORBIT_MASTER_PLAN.md`.
- **Current branch:** `codex/orbit-completion` (branched from `main` at `3872889`).
- **Most recent feature commit:** `51d4ae6 Make meeting password changes atomic and add join prompts` on `codex/orbit-completion` (following `136fd40` and its progress-record commit).
- **Completed and verified this session:** Registered/viewed hourly thread heartbeat. Read Expo SDK 57 reference. Source inventory and initial security review. First security/truthful-controls checkpoint was committed and pushed. Second checkpoint `51d4ae6` adds atomic host-checked meeting password changes, host setup/removal UI, and a guest password prompt. TypeScript, lint, web/iOS JavaScript exports, and meeting-link parser tests pass. Native hand/reaction and SQL changes remain **unverified on backend/devices**.
- **Remaining features:** See the feature inventory in `ORBIT_MASTER_PLAN.md` and per-feature matrix in `ORBIT_TEST_MATRIX.md`. Major gaps include account deletion/edit/recovery, contact removal, whiteboard sync, meeting lifecycle/host controls, notification lifecycle, AI transcript pipeline, real summaries, and platform QA.
- **Open bugs:** High-severity participant-lifecycle finding remains; see `ORBIT_SECURITY_AUDIT.md`. Both quota and password migrations are untested against a database and undeployed.
- **Tests executed:** `npx tsc --noEmit` PASS; `npm test` PASS (2 tests); `npm run lint` PASS (0 warnings); `npx expo export --platform web` PASS (55 static routes); `npx expo export --platform ios` PASS (Hermes bundle); `xcodebuild` Debug iOS simulator build PASS before the second JavaScript-only checkpoint. The ad-hoc signed app installed and reached the sign-in screen on the dedicated iOS 26.5 Orbit Test simulator with Metro running, including after the latest JavaScript changes. The unsigned build failed to access Keychain, so signed builds are required for meaningful startup QA. `npx expo install --check` says up to date but used an offline dependency map, so it is inconclusive. No authenticated native journey, database, or two-user test has passed.
- **Environment / credentials:** `.env.local` contains client Supabase variables and is Git-ignored. Connected Supabase app only lists a different project, so Orbit's live database cannot be safely inspected through it. No Docker, Deno, `psql`, or local Postgres executable found; official Supabase CLI is available through `npx` with network escalation. LiveKit/Groq secrets and test accounts have not been verified. Local scheduled work needs the Mac and app running.
- **Exact next implementation task:** Implement secure synchronized whiteboard strokes and late-join state; validate the quota and password migrations, host/guest password paths, and RLS in an isolated Supabase environment before deployment.

## Next Codex session

1. Read all six `ORBIT_*.md` files, then inspect `git status`, branch, latest commit, and changed files. Do not assume this note is newer than Git.
2. Check the Goal and heartbeat; avoid a parallel writer and avoid consuming calls during a known exhausted usage window.
3. Resume the exact next task above. Run relevant tests, document actual pass/fail/blocked evidence, review diff for secrets, commit and push a verified checkpoint.
4. Continue subsequent milestones. Do not label production-ready until the definition of done in the mission has evidence.
