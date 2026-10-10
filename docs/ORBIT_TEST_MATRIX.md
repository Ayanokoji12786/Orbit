# Orbit test matrix

Updated 2026-10-10. `PASS` means a named test actually ran; `BLOCKED` means no test claim. Source review is not runtime verification. This matrix is a release gate and must be updated on each checkpoint.

| Feature | Expected behavior | Actual / code evidence | Tests executed and result | Status / remaining risk |
| --- | --- | --- | --- | --- |
| Email OTP | Request and verify code, persist session | API and screens present | iOS signed simulator reached sign-in screen; auth journey not run | BLOCKED: isolated account/provider config |
| Google / Apple sign-in | Native provider login | Native integrations present | TypeScript PASS; device journey not run | BLOCKED: provider/device |
| Sign-out / recovery / deletion | Revoke session; securely recover/delete | Sign-out now reports failures; recovery/deletion missing | TypeScript/lint/web+iOS exports PASS; no authenticated journey | FAIL: recovery/deletion missing |
| Profile / contacts | Edit name/bio/photo, find/add/remove contacts | Private avatar upload and signed rendering, favorite/remove, load/error states implemented | PGlite profile/avatar grants and path RLS PASS; no hosted upload/device test | PARTIAL: hosted and UI verification pending |
| Direct messages | Private, ordered, realtime delivery | RLS and Realtime hooks exist | No two-user test | BLOCKED: isolated backend accounts |
| Image / file attachments | Private upload, signed read, errors | Image path exists; other files absent | No upload test | FAIL: partial |
| Instant / scheduled meetings | Create, list, join, reschedule and cancel | Host detail fetch, reschedule, cancel, and terminal status implemented | PGlite host scheduling/terminal grants PASS; no device/backend test | BLOCKED: hosted/device flow |
| Join code/link | Accept six-character code or Orbit link, reject lookalikes | Parser added; join UI uses it | `npm test`: 2/2 PASS | PASS unit; native navigation pending |
| Password / token authorization | Host-only atomic password changes; guest challenge; valid token; bounded attempts | Host/guest UI, atomic RPC, terminal checks and quota hardening | PGlite hash, grant, limiter, and terminal tests PASS; Edge/function and two-account tests absent | BLOCKED: deploy and integration test |
| Media / screen share / reconnect | Native call, toggles, share and recover | Native LiveKit code; web preview now labels disabled native-only controls and does not mint a token | Web export PASS; no device test | BLOCKED: iOS and Android |
| In-call chat / polls | Active-participant messages, uploads and votes | RLS and lifecycle revocation implemented | PGlite active guest write/vote, leave/end/cancel denial PASS; no Realtime/two-user test | BLOCKED: hosted collaboration |
| Raise Hand / reactions | Visible to all live participants | LiveKit attributes and data packets added locally | TypeScript PASS; no two-device test | BLOCKED: token deployment/device |
| Whiteboard | Synchronized authorized strokes, late-join replay, host-only clear | Normalized bounded event log/RPC, realtime merge and local preview | 4 event tests and PGlite membership/host-clear RLS PASS; no two-device sync | BLOCKED: deployment and multi-user validation |
| Reminders / notification inbox | Schedule, navigate, cancel/reschedule | Local reminder replacement/removal, permissions and tap routing; inbox says unavailable | TypeScript/lint/web+iOS exports PASS; no device notification test | PARTIAL: device and cross-device behavior |
| AI assistant | Authorized bounded server-side model calls | Groq Edge Function present | No configured end-to-end test | BLOCKED: backend/key |
| Summary/notes/actions/transcription/captions/translation/search | Consent-gated processing and honest results | Fabricated summary/recording content removed; no pipeline | Web export PASS; no backend test | FAIL: missing |
| UI/accessibility | Every route and control usable on iOS/Android/web preview | Many routes unreviewed; stubs remain | No visual/device audit | BLOCKED / partial |
| TypeScript / lint / dependency fit | Clean checks | PGlite test dependency pinned; TypeScript and lint clean | `tsc` PASS; fresh lint PASS; `npm test` 13/13 PASS; Expo check previously offline | PARTIAL: hosted/runtime and dependency review |
| Web preview build | All preview routes export | Static web export completed | `npx expo export --platform web` PASS (55 routes) | PASS build; visual/browser review pending |
| Native builds | iOS/Android build and smoke test | Native projects exist | iOS JavaScript export PASS; earlier iOS Debug simulator build/startup reached sign-in before this checkpoint; Android not run | PARTIAL: new native build, authenticated journeys and Android pending |

## Release test expansion

Add focused unit tests for parsers and business rules, integration tests for Edge Functions and RLS in an isolated Supabase database, then two-account meeting/message/poll/storage tests. Exercise expired sessions, denied permissions, offline/reconnect, failed uploads, duplicate actions and notification taps. Record iOS and Android results separately. Do not substitute web preview or mocked data for native verification.
