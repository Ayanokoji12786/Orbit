# Orbit security audit

Updated 2026-10-10. Findings are from local source review; no Orbit production database was queried or modified.

| Severity | Finding and evidence | Current action / verification |
| --- | --- | --- |
| Critical | `public.check_rate_limit(bucket, max, window)` let authenticated clients weaken quotas and had a first-call race. | Local migration binds supported tuples and atomically increments. PGlite policy/count tests PASS; true concurrent connections and hosted deployment remain untested. |
| High | `livekit-token` continued issuing token/password checks when the limiter RPC errored, enabling unlimited guesses during a limiter failure. | Local function now returns 503 on limiter failure. **Not deployed or integration-tested.** |
| High | Password flag and secret were written separately, risking inconsistent protection. | Host-checked transactional RPC and flag guard pass PGlite tests for atomic state and direct-write denial; Edge Function remains undeployed. |
| High | Permanent `meeting_participants` rows retained access after leaving or meeting closure. | New leave/end/cancel RPCs, five-minute leases, and active-member RLS revoke chat, polls, uploads and whiteboard access; PGlite tests PASS. LiveKit revocation, hosted RLS and Realtime remain unverified. |
| High | Authenticated profile users could directly update `public.users.email` and `status`, or insert spoofed rows if their row was absent. | New column-level grants and removal of client INSERT pass PGlite impersonation tests. OAuth/signup and hosted behavior remain unverified. |
| High | `find_user_by_email` is a privileged, authenticated lookup. Existing limiter reduces enumeration but must be verified after quota hardening. | Open isolated DB test. |
| Medium | `groq-chat` accepts caller-provided meeting title and history without proving meeting membership; it has no audio/transcript context. | Constrain context claims; require consent before future transcript processing. |
| Medium | Guest meeting image uploads were denied because Storage policy queried a host-only meeting row through invoker RLS. | Replaced meeting branch with a validated path and definer membership helper; PGlite active-guest upload and post-leave/end denial PASS. Hosted Storage behavior remains unverified. |
| Medium | Private chat image signed URLs remained valid for one hour after access was revoked. | TTL shortened to five minutes with refresh for active viewers. Already-issued links can still be used until expiry; immediate file revocation remains open. |
| Medium | Whiteboard event RPC and Realtime rely on membership and bounded history. | PGlite validates stroke payloads, host clear, outsider denial and lifecycle revocation; Realtime subscriptions, two-device order and concurrent clear/stroke remain unverified. |
| Medium | Private avatar objects need owner-only writes and bounded contact reads. | New private bucket and path policy allow owner writes and current contact reads of the referenced image; PGlite RLS tests PASS. Device upload and hosted Storage tests pending. |
| Medium | Account deletion/data cleanup is absent; auth token/session revocation policy has not been tested. | Open. |

Positive source findings: service-role and LiveKit/Groq secrets are only referenced in Edge Functions; mobile uses a publishable/anon credential. All 12 local migrations apply in PGlite PostgreSQL 17.5 with grants/RLS assertions. PGlite uses minimal Supabase service shims and one connection; it is not proof of deployed Auth, Storage, Realtime, Edge Function, or concurrent behavior. Review hosted grants, RLS advisors and deployed migrations in an isolated Orbit project before asserting release security.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase definer advisor](https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0029_authenticated_security_definer_function_executable), [Supabase Data API grant change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
