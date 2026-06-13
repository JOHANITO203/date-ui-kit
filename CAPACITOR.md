# Packaging Exotic as a native app (Capacitor)

The app is a mobile-first PWA. Capacitor wraps the **same** built web app (`dist/`)
into native Android (APK/AAB) and iOS (IPA) shells — one codebase, three targets
(web, Android, iOS). Users see a native app; the Store sees a native binary.

The web bundle already detects the native runtime and upgrades behavior:
- **Haptics** → native OS haptics on iOS *and* Android (the web Vibration API
  doesn't exist on iOS Safari). See [src/utils/haptics.ts](src/utils/haptics.ts).
- **Share** → native share sheet, Web Share API fallback. See
  [src/utils/native.ts](src/utils/native.ts).
- **Status bar** configured at startup ([src/main.tsx](src/main.tsx)).

## Prerequisites (local machine — cannot run in CI without these)

- **Android:** Android Studio + JDK 17 + Android SDK.
- **iOS:** a Mac with Xcode + CocoaPods.

## One-time setup

```bash
# JS deps are already in package.json (@capacitor/core + plugins; @capacitor/cli dev).
npm install

# Add the platform packages (only needed locally, where the toolchain lives):
npm install @capacitor/android @capacitor/ios

# Generate the native projects (creates ./android and ./ios — gitignored):
npm run build
npx cap add android
npx cap add ios
```

## Build / run loop

```bash
# Build the web app and copy it into the native projects:
npm run cap:sync

# Open in the native IDE to run on a device/emulator and produce a binary:
npm run cap:open:android   # → Android Studio → Build > Generate Signed Bundle/APK
npm run cap:open:ios       # → Xcode → Product > Archive
```

`appId` / `appName` / colors live in [capacitor.config.ts](capacitor.config.ts).

## Two delivery models

1. **Bundled (default, store-ready):** web assets ship inside the binary —
   offline-capable, no server dependency. Just `cap sync` and build.
2. **Server-hosted (hot updates):** set `CAP_SERVER_URL` and uncomment the
   `server` block in `capacitor.config.ts` to load the live PWA. Faster iteration,
   but the app needs connectivity to boot.

## Native plugins already wired

`@capacitor/haptics`, `@capacitor/share`, `@capacitor/app`, `@capacitor/status-bar`.

## Remaining native wiring (handoff)

- **Native push (iOS APNs / Android FCM):** the PWA uses Web Push today. For
  store-grade native push, add `@capacitor/push-notifications`, configure
  Firebase (Android) + APNs (iOS), and register the device token with the
  existing `/api/push/subscribe` endpoint (extend it to accept native tokens).
- **Native camera / geolocation:** the web app uses `<input capture>` and
  `navigator.geolocation`, which work inside the Capacitor WebView. Swap to
  `@capacitor/camera` / `@capacitor/geolocation` if you need native pickers or
  background location.
- **Deep links / universal links** for match/notification routing.
- App icons & splash screens: generate with `@capacitor/assets`.
