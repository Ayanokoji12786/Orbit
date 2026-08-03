# Orbit

A premium, AI-first mobile communication app. Built with Expo + TypeScript + Expo Router.

## Status: Phase 1

This is the first build pass: project scaffold, full design system, complete navigation shell, and
polished Splash/Onboarding/Auth/Home screens. Auth is wired to real Supabase code (Email OTP,
Magic Link, Apple Sign-In, Google Sign-In) but needs your own credentials to actually authenticate.
Meetings/Contacts/Settings/Recordings/Notifications run on local mock data with real, on-brand UI —
not dead ends, just not backed by a live database yet. The active meeting screen is a visual preview
of the calling UI; it does not carry real video until LiveKit is wired in Phase 2.

See `.env.example` for every credential the app can use and what breaks without it.

## Running it

This app uses native modules (Apple Sign-In, and LiveKit/ReplayKit/MediaProjection in later phases),
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

## Environment

```bash
cp .env.example .env
```

Fill in what you have — the app boots and every screen is reachable with an empty `.env`. Auth
buttons and Sign Out are disabled with an inline explanation until `EXPO_PUBLIC_SUPABASE_URL` /
`EXPO_PUBLIC_SUPABASE_ANON_KEY` are set.

## Project structure

```
src/
  app/                 Expo Router routes (thin — compose feature screens)
  design-system/       color/type/spacing/motion tokens, useAppTheme()
  components/ui/       design-system-driven primitives (Button, GlassCard, Avatar, ...)
  components/navigation/  tab bar, screen header, stub-screen helpers
  features/<name>/     screen-specific components, api calls, hooks — one folder per feature
  stores/              zustand stores (auth, theme, app state)
  lib/                 external clients (supabase)
  types/                shared domain types
```

## Roadmap

- **Phase 2** — Supabase schema wired live, LiveKit video calling, real meeting room.
- **Phase 3** — Chat, whiteboard, file sharing, push notifications, scheduling.
- **Phase 4** — AI summaries, live captions/translation, AI assistant, transcript search.
- **Phase 5** — Performance, security hardening, accessibility pass, testing, store submission.
