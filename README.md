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

### Browser app on Vercel

Import this repository in [Vercel](https://vercel.com/new). The included `vercel.json`
installs with the lockfile, exports Expo's browser app, and routes direct meeting links
back to the app. Use Node.js 24 for the build.

Before deploying, add `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` in Vercel's project environment settings. These are
public client configuration; never use a Supabase service-role key. Redeploy after
changing these values because Expo embeds them during the build.
Local builds after changing `.env.local` should also use `npx expo export --platform
web --clear` to prevent Metro from reusing a bundle with old client configuration.

Complete the Supabase migrations and LiveKit Edge Function setup below. Vercel hosts
the browser interface; LiveKit carries meeting media and Supabase handles accounts,
meeting access, chat, and polls. The browser room uses real LiveKit audio/video,
participant tiles, and browser screen sharing. Camera and microphone start off;
participants enable them explicitly and may need to click **Enable meeting audio**.

In Supabase Authentication > URL Configuration, set the deployed HTTPS URL as the
Site URL and add its origin to the allowed redirect URLs. Enable the Google provider
for browser Google sign-in and set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in Vercel to
enable its button; the OAuth secret stays in Supabase. Configure Google's
authorized redirect URI using Supabase's callback URL. Email-code sign-in also works
with the email template setup below. Do not broadly allow every Vercel preview origin.

After deployment, test direct links and refreshing `/meeting/<room-code>`, sign in with
two separate browser profiles, and join the same meeting. Verify mutual audio/video,
screen sharing, and leaving the call. A successful static build alone does not verify
the connected backend.

### Native app

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

### 5. In-meeting AI assistant (optional)

The existing assistant uses Groq through the authenticated `groq-chat` Edge Function.
Set `GROQ_API_KEY` securely in the Supabase project's Edge Function secrets, then deploy:

```bash
supabase functions deploy groq-chat
```

The function uses `openai/gpt-oss-120b` and applies a per-user rate limit. Keep the API
key on the server; never add it to an `EXPO_PUBLIC_` variable.

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

- **Phase 4** — The in-meeting AI assistant is implemented through Groq. AI summaries,
  live captions/translation, and transcript search still need their backend pipelines.
- **Phase 5** — Performance, security hardening, accessibility pass, testing, store submission,
  screen sharing (ReplayKit/MediaProjection).
