# Orbit

A premium, AI-first mobile communication app. Built with Expo + TypeScript + Expo Router.

## Status: Phase 2 (real backend)

- **Phase 1** — design system, navigation shell, Splash/Onboarding/Auth/Home.
- **Phase 3** — Chat (DM + in-meeting), Whiteboard, Polls, Reactions, scheduling, local notifications.
- **Phase 2 (this pass)** — real backend. Auth, Contacts, Meetings, Chat, and Polls are wired to
  **Firebase** (Auth + Firestore + Storage + Cloud Functions), and the meeting room uses real
  **LiveKit** video/audio instead of the earlier mock preview.

The app boots and every screen is reachable with no credentials configured at all — features that
need the backend show an inline explanation instead of crashing. See `.env.example` for the client
side and "Firebase & LiveKit setup" below for everything else.

## Running it

This app uses native modules (Firebase, Google/Apple Sign-In, LiveKit, ReplayKit/MediaProjection),
so **it cannot run in Expo Go**. Use a development build:

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

## Firebase & LiveKit setup

### 1. Firebase project

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Upgrade to the Blaze (pay-as-you-go) plan.** Cloud Functions require it even at zero usage —
   there's a large free monthly quota, so this app won't actually cost anything at dev scale, but
   Firebase still requires a billing account attached.
3. Add an iOS app (bundle ID `app.orbit.mobile`) and an Android app (package `app.orbit.mobile`).
   Download **GoogleService-Info.plist** and **google-services.json** and place them at the project
   root (gitignored — never commit them).
4. Authentication > Sign-in method: enable **Email link (passwordless sign-in)**, **Google**, and
   **Apple**.
5. Authentication > Settings > Authorized domains: note your default
   `<project-id>.firebaseapp.com` domain — that's your `EXPO_PUBLIC_FIREBASE_AUTH_CONTINUE_URL`.
6. Project Settings > General > Your apps: the Google **Web client ID** (also in
   `google-services.json` under `client[].oauth_client[]` where `client_type` is 3) is your
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
7. `cp .env.example .env` and fill in both values above.

### 2. Firestore + Storage rules and indexes

```bash
npm install -g firebase-tools   # if you don't have it
firebase login
firebase use --add              # pick your project
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 3. LiveKit project

1. Create a project at [cloud.livekit.io](https://cloud.livekit.io) (or self-host later).
2. Note the WebSocket URL and your API key/secret.

### 4. Cloud Functions secrets, then deploy

```bash
firebase functions:secrets:set LIVEKIT_API_KEY
firebase functions:secrets:set LIVEKIT_API_SECRET
cd functions && cp .env.example .env   # fill in LIVEKIT_URL, non-secret
cd ..
firebase deploy --only functions
```

### Local emulation (optional, no billing needed for this part)

```bash
cd functions && cp .secret.local.example .secret.local   # fill in LiveKit key/secret
cd .. && firebase emulators:start
```

## Known limitation: magic-link deep linking

Firebase's passwordless email sign-in sends a link, not a code. Without a verified custom domain +
Universal Links/App Links entitlements (not set up in this pass), tapping the email link opens a
browser instead of jumping straight back into the app. The sign-in screen has a manual "paste the
link here" fallback so the flow is still fully usable today; wiring real deep linking is a Phase 5
hardening item.

## Project structure

```
src/
  app/                 Expo Router routes (thin — compose feature screens)
  design-system/       color/type/spacing/motion tokens, useAppTheme()
  components/ui/       design-system-driven primitives (Button, GlassCard, Avatar, ...)
  components/navigation/  tab bar, screen header, stub-screen helpers
  features/<name>/     screen-specific components, api calls, hooks — one folder per feature
  stores/              zustand stores (auth, theme, app state)
  lib/                 external clients (firebase, livekit) — .web.ts variants stub these out,
                       since Firebase/LiveKit's native SDKs don't build for web
  types/               shared domain types
functions/             Firebase Cloud Functions (livekitToken, onUserCreate, setMeetingPassword)
firestore.rules        Firestore security rules
storage.rules           Storage security rules
```

## Roadmap

- **Phase 4** — AI summaries, live captions/translation, AI assistant, transcript search. Needs a
  Claude API key behind a server (never in the client) — paused pending that decision.
- **Phase 5** — Performance, security hardening, accessibility pass, testing, store submission,
  real magic-link deep linking, screen sharing (ReplayKit/MediaProjection).
