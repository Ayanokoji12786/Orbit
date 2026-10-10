# Orbit security audit

Updated 2026-10-10. Findings are from local source review; no Orbit production database was queried or modified.

| Severity | Finding and evidence | Current action / verification |
| --- | --- | --- |
| Critical | `public.check_rate_limit(bucket, max, window)` was granted to all authenticated clients. Any client could pass a zero-minute window to reset a shared Groq/LiveKit quota. Its first-call read/insert path also had a concurrency race. | Local migration `20261009190001_harden_rate_limits.sql` binds supported tuples to server policy and atomically increments. **Not deployed or DB-tested.** |
| High | `livekit-token` continued issuing token/password checks when the limiter RPC errored, enabling unlimited guesses during a limiter failure. | Local function now returns 503 on limiter failure. **Not deployed or integration-tested.** |
| High | `set-meeting-password` performs meeting flag and secret writes separately without checking errors; a partial failure can leave the password flag out of sync. | Open. Use an atomic, host-authorized operation and test failure cases before deployment. |
| High | Meeting authorization uses durable `meeting_participants` rows added by token issue. There is no leave/revocation or lifecycle status; former participants may retain access to messages/polls/files indefinitely. | Open design and multi-user test. Decide retention and rejoin policy before altering RLS. |
| High | `find_user_by_email` is a privileged, authenticated lookup. Existing limiter reduces enumeration but must be verified after quota hardening. | Open isolated DB test. |
| Medium | `groq-chat` accepts caller-provided meeting title and history without proving meeting membership; it has no audio/transcript context. | Constrain context claims; require consent before future transcript processing. |
| Medium | Private `chat-uploads` bucket and membership policies are present in latest migration; need unauthorized read/list/write tests, including cross-meeting and cross-DM paths. | Blocked on isolated backend. |
| Medium | Account deletion/data cleanup is absent; auth token/session revocation policy has not been tested. | Open. |

Positive source findings: service-role and LiveKit/Groq secrets are only referenced in Edge Functions; mobile uses a publishable/anon credential. RLS is enabled on application tables; `polls_with_my_vote` uses `security_invoker`; previous migrations restrict meeting chat, polls, and storage. These are source findings, not proof of deployed state. Review function grants, RLS advisors and deployed migrations in an isolated Orbit project before asserting security.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase definer advisor](https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0029_authenticated_security_definer_function_executable), [Supabase Data API grant change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
