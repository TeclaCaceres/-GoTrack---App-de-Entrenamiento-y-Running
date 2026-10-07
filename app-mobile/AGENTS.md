# GoTrack — Mobile App (Expo / React Native)

GoTrack is a running/training tracker app. This package is the mobile client.
Prioritize mobile-first patterns, performance, battery/GPS efficiency, and cross-platform compatibility.

## Project reality — read this first

- **Single-file app**: the whole UI lives in `App.js` (registered via `index.js` → `registerRootComponent`). There is **no `src/app/` and no expo-router installed**. Do not introduce routing libraries or restructure into `src/app/` unless explicitly asked.
- **JavaScript, not TypeScript**: there is no `tsconfig.json`. Keep new code in `.js`.
- **npm, not bun**: this repo uses `package-lock.json`. Use `npx`/`npm`, not `bunx`.
- **No lint/typecheck scripts configured** in `package.json` (only `start`, `android`, `ios`, `web`). Don't claim they pass; add them if the task calls for it.
- Local persistence: **expo-sqlite** + **AsyncStorage**. Maps: `react-native-maps`. Sensors: `expo-sensors` (Pedometer), `expo-location`, `expo-speech`, `expo-audio`, `expo-keep-awake`. Sharing/export: `expo-file-system/legacy` + `expo-sharing`.
- Backend lives in the sibling folder `../gotrack-backend` (Node/Express, `server.js`). Check it before changing sync/API assumptions.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json` (currently SDK ~57).
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

```bash
npx expo install <package>   # ALWAYS use instead of npm/yarn/pnpm add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo start --android    # android
npx expo start --ios        # ios
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run as `npx eas-cli@latest <command>`. Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries. Docs: https://docs.expo.dev/versions/latest/index.md
- GPS/sensors/keep-awake run during workouts: clean up subscriptions, watchers, timers and `deactivateKeepAwake()` on unmount or workout end — leaks drain battery.
- Ask for permission flows (location, motion/pedometer) before using them; handle denial gracefully.
- UI is dark-mode-first (`isDarkMode` state in `App.js`); keep both themes readable.
