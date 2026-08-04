# Orbit

A premium, AI-first mobile communication app. Built with Expo + TypeScript + Expo Router.

## Status: Phase 2 (real backend)

- **Phase 1** — design system, navigation shell, Splash/Onboarding/Auth/Home.
- **Phase 3** — Chat (DM + in-meeting), Whiteboard, Polls, Reactions, scheduling, local notifications.
- **Phase 2 (this pass)** — real backend. Auth, Contacts, Meetings, Chat, and Polls are wired to
  **Supabase** (Auth + Postgres + Storage + Edge Functions), and the meeting room uses real
  **LiveKit** video/audio instead of the earlier mock preview.

The app boots and every screen is reachable with no credentials configured at all — features that
need the backend show an inline explanation instead of crashing. See `.env.example` for the client
side and "Supabase & LiveKit setup" below for everything else.

## Running it

This app uses native modules (Google/Apple Sign-In, LiveKit, ReplayKit/MediaProjection), so **it
cannot run in Expo Go**. Use a development build:

```bash
npm install
npx expo prebuild
npx expo run:ios     # or: npx expo run:android
```

Day-to-day, once the dev build is installed on a simulator/device:

```bash
npx expo start
```

Missing on this machine and needed before a native build will fully succeed:

```bash
brew install watchman cocoapods
```

## Supabase & LiveKit setup

### 1. Supabase project

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Project Settings > API: note the **Project URL** and **anon public key** — those are your
   `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. Authentication > Providers:
   - **Email**: enabled by default. This app signs in with a 6-digit code rather than a link, so
     edit Authentication > Email Templates > **Magic Link** and add `{{ .Token }}` somewhere in the
     body — the code is generated either way, but the default template only surfaces the link.
   - **Google**: enable, then paste in a Client ID + Secret from a "Web application" OAuth client
     in [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Put that same
     Client ID in `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
   - **Apple**: enable, then fill in the Services ID, Team ID, Key ID, and private key from your
     Apple Developer account.
4. `cp .env.example .env` and fill in the values above.

### 2. Database schema, RLS policies, and storage

```bash
npm install -g supabase   # if you don't have it
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

This applies everything under `supabase/migrations/` — tables, row-level security policies, the
`handle_new_user` trigger, the `cast_vote` function, realtime publication, and the `chat-uploads`
storage bucket + its policies. No separate manual dashboard step needed.

### 3. LiveKit project

1. Create a project at [cloud.livekit.io](https://cloud.livekit.io) (or self-host later).
2. Note the WebSocket URL and your API key/secret.

### 4. Edge Function secrets, then deploy

```bash
supabase secrets set LIVEKIT_API_KEY=...
supabase secrets set LIVEKIT_API_SECRET=...
supabase secrets set LIVEKIT_URL=...
supabase functions deploy livekit-token
supabase functions deploy set-meeting-password
```

### Local development (optional, no live project needed)

```bash
supabase start          # local Postgres + Auth + Storage + Realtime via Docker
supabase db reset       # applies every migration
supabase functions serve   # serve both edge functions locally
```

Point `.env` at the local URL/anon key `supabase start` prints when it starts up.

## Project structure

```
src/
  app/                 Expo Router routes (thin — compose feature screens)
  design-system/       color/type/spacing/motion tokens, useAppTheme()
  components/ui/       design-system-driven primitives (Button, GlassCard, Avatar, ...)
  components/navigation/  tab bar, screen header, stub-screen helpers
  features/<name>/     screen-specific components, api calls, hooks — one folder per feature
  stores/              zustand stores (auth, theme, app state)
  lib/                 external clients (supabase, livekit) — supabase.ts is a single universal
                       client that runs the same on native and web; only livekit still needs a
                       native-only SDK
  types/               shared domain types
supabase/
  migrations/          Postgres schema, RLS policies, the handle_new_user trigger, cast_vote()
  functions/           Edge Functions (livekit-token, set-meeting-password)
```

## Roadmap

- **Phase 4** — AI summaries, live captions/translation, AI assistant, transcript search. Needs a
  Claude API key behind a server (never in the client) — paused pending that decision.
- **Phase 5** — Performance, security hardening, accessibility pass, testing, store submission,
  screen sharing (ReplayKit/MediaProjection).
