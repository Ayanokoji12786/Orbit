# Orbit blockers and external setup

Updated 2026-10-10. These are specific limits, not permission to claim a test passed.

| Blocker | Evidence | Work possible meanwhile / unlock |
| --- | --- | --- |
| Orbit Supabase project not available in connected account | Supabase connector lists only an unrelated project; `.env.local` points elsewhere. | Maintain migrations/functions locally. Isolated Orbit project access or local Docker/Postgres is needed for SQL/RLS two-user tests. Never apply migration to the unrelated project. |
| No local database runtime | No `docker`, `psql`, `pg_ctl`, `initdb`, or Deno command found. | Official Supabase CLI can create migrations via `npx`; SQL execution needs a safe database. |
| Authenticated native behavior not yet verified | Ad-hoc signed iOS Debug app installed and reached sign-in screen; no signed-in iOS/Android journey has run. An unsigned simulator app cannot access SecureStore Keychain. | Test authenticated journeys with isolated accounts; Android remains separate. |
| LiveKit/Groq configuration unknown | No provider secret was read or printed; deployment state unverified. | Unit and mocked integration tests can proceed; real calls need authorized function deployments and test accounts. |
| Hosted continuation unavailable for this checkout | The registered heartbeat targets this local thread/project. [Scheduled task documentation](https://learn.chatgpt.com/docs/automations) says local-file tasks need the computer and app running. | Mac awake + app running permits hourly runs. A separately configured cloud coding environment could run while the laptop sleeps; none was verified here. |

The heartbeat `continue-orbit-development` is **registered and active**. The Goal was created, but its latest status was `blocked`; check it on continuation. The heartbeat must not start duplicate work during an active writer or repeatedly consume calls while a known limit is exhausted. No paid service or app-store publication is authorized.
