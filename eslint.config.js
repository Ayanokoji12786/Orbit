// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'ios/*', 'android/*'],
  },
  {
    rules: {
      // Guards against react-dom's HTML parsing of apostrophes/quotes. Every string in
      // this app renders through <AppText> → React Native <Text>, where those characters
      // are literal, so the rule only produces noise here.
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    // These hooks clear their own state when the id/user they're keyed on changes, so the
    // "stale data from the previous id" flash can't happen. That's a deliberate one-render
    // reset on a path that only runs when the key changes — not a cascading-render bug.
    files: [
      'src/features/**/api.ts',
      'src/features/**/*-api.ts',
      'src/features/chat/useSignedImageUrl.ts',
      'src/features/meeting-room/LiveRoom.tsx',
      'src/features/meeting-room/LiveRoom.web.tsx',
      'src/features/meeting-room/PollsPanel.tsx',
      'src/hooks/use-color-scheme.web.ts',
    ],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    // The gesture callbacks here read a ref, but they only ever run from Reanimated
    // worklets via runOnJS — never during render, which is what the rule is guarding.
    files: ['src/features/meeting-room/WhiteboardCanvas.tsx'],
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
    },
  },
]);
