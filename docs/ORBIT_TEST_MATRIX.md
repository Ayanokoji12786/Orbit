# Orbit test matrix

Updated 2026-10-10. `PASS` means a named test actually ran; `BLOCKED` means no test claim. Source review is not runtime verification. This matrix is a release gate and must be updated on each checkpoint.

| Feature | Expected behavior | Actual / code evidence | Tests executed and result | Status / remaining risk |
| --- | --- | --- | --- | --- |
| Email OTP | Request and verify code, persist session | API and screens present | iOS signed simulator reached sign-in screen; auth journey not run | BLOCKED: isolated account/provider config |
| Google / Apple sign-in | Native provider login | Native integrations present | TypeScript PASS; device journey not run | BLOCKED: provider/device |
| Sign-out / recovery / deletion | Revoke session; securely recover/delete | Sign-out exists; recovery/deletion missing | None | FAIL: missing flows |
| Profile / contacts | Edit profile, find/add/remove contacts | Profile edit stub; add/favorite exist; remove absent | Source review only | FAIL: incomplete |
| Direct messages | Private, ordered, realtime delivery | RLS and Realtime hooks exist | No two-user test | BLOCKED: isolated backend accounts |
| Image / file attachments | Private upload, signed read, errors | Image path exists; other files absent | No upload test | FAIL: partial |
| Instant / scheduled meetings | Create, list, join and manage | Create/list exists; lifecycle incomplete | No device/backend test | BLOCKED / partial |
| Join code/link | Accept six-character code or Orbit link, reject lookalikes | Parser added; join UI uses it | `npm test`: 2/2 PASS | PASS unit; native navigation pending |
| Password / token authorization | Host-only atomic password changes; guest challenge; valid token; bounded attempts | Host and guest UI, hash-only Edge Function, host-checked atomic RPC, quota hardening added locally | TypeScript/lint and web/iOS JS exports PASS; no isolated DB/function or two-account test | BLOCKED: migration/deploy and host/guest integration test |
| Media / screen share / reconnect | Native call, toggles, share and recover | Native LiveKit code; web preview now labels disabled native-only controls and does not mint a token | Web export PASS; no device test | BLOCKED: iOS and Android |
| In-call chat / polls | Participant-scoped realtime messages and votes | Tables, RLS, UI and subscriptions | No two-user test | BLOCKED |
| Raise Hand / reactions | Visible to all live participants | LiveKit attributes and data packets added locally | TypeScript PASS; no two-device test | BLOCKED: token deployment/device |
| Whiteboard | Synchronized, authorized strokes | Strokes are local state | None | FAIL: not collaborative |
| Reminders / notification inbox | Schedule, navigate, cancel/reschedule | Local scheduling; fabricated inbox removed and honest empty state shown | Web export PASS; no device test | FAIL: partial |
| AI assistant | Authorized bounded server-side model calls | Groq Edge Function present | No configured end-to-end test | BLOCKED: backend/key |
| Summary/notes/actions/transcription/captions/translation/search | Consent-gated processing and honest results | Fabricated summary/recording content removed; no pipeline | Web export PASS; no backend test | FAIL: missing |
| UI/accessibility | Every route and control usable on iOS/Android/web preview | Many routes unreviewed; stubs remain | No visual/device audit | BLOCKED / partial |
| TypeScript / lint / dependency fit | Clean checks | TypeScript and lint pass | `tsc` PASS; lint 0 errors, 0 warnings; Expo check offline | PARTIAL: dependency check inconclusive |
| Web preview build | All preview routes export | Static web export completed | `npx expo export --platform web` PASS (55 routes) | PASS build; visual/browser review pending |
| Native builds | iOS/Android build and smoke test | Native projects exist | iOS Debug simulator `xcodebuild` PASS; ad-hoc signed app installed and reached sign-in screen on iOS 26.5 Orbit Test; Android not run | PARTIAL: authenticated journeys and Android pending |

## Release test expansion

Add focused unit tests for parsers and business rules, integration tests for Edge Functions and RLS in an isolated Supabase database, then two-account meeting/message/poll/storage tests. Exercise expired sessions, denied permissions, offline/reconnect, failed uploads, duplicate actions and notification taps. Record iOS and Android results separately. Do not substitute web preview or mocked data for native verification.
