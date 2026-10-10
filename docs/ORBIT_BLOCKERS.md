# Orbit blockers and external setup

Updated 2026-10-10. These are specific limits, not permission to claim a test passed.

| Blocker | Evidence | Work possible meanwhile / unlock |
| --- | --- | --- |
| Orbit Supabase project not available in connected account | Supabase connector lists only an unrelated project; `.env.local` points elsewhere. | All 12 migrations now apply in PGlite with 13 automated tests, but isolated Orbit project access is still needed for hosted Auth/Storage/Realtime/Edge Function and two-account verification. Never apply migrations to the unrelated project. |
| No full local Supabase/LiveKit runtime | No Docker, Deno, `psql`, `pg_ctl`, or `initdb` executable found. PGlite supplies an isolated PostgreSQL 17.5 test runtime only. | Keep SQL grant/RLS tests in `npm test`; use isolated hosted services or a working local stack for actual Edge, Storage, Realtime and LiveKit tests. |
| Authenticated native behavior not yet verified | Ad-hoc signed iOS Debug app installed and reached sign-in screen; no signed-in iOS/Android journey has run. An unsigned simulator app cannot access SecureStore Keychain. | Test authenticated journeys with isolated accounts; Android remains separate. |
| LiveKit/Groq configuration unknown | No provider secret was read or printed; deployment state unverified. | Local code and SQL tests can proceed; real calls, token revocation and AI behavior need authorized function deployments and test accounts. |
| Native notification and avatar behavior unverified | Web/iOS JavaScript exports pass, but no signed-in device journey ran after this checkpoint. | Test photo permissions/upload, local reminder tap/replacement/cancel, timezone behavior, and LiveKit end/leave on signed iOS and Android builds. |
| Hosted continuation unavailable for this checkout | The registered heartbeat targets this local thread/project. [Scheduled task documentation](https://learn.chatgpt.com/docs/automations) says local-file tasks need the computer and app running. | Mac awake + app running permits hourly runs. A separately configured cloud coding environment could run while the laptop sleeps; none was verified here. |

The heartbeat `continue-orbit-development` and the Goal are **active** as of this checkpoint. The heartbeat must not start duplicate work during an active writer or repeatedly consume calls while a known limit is exhausted. No paid service or app-store publication is authorized.
