import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor wraps the built PWA (webDir: 'dist') into native Android/iOS shells.
// By default the web assets are BUNDLED into the app (offline-capable, store-ready).
// To point a native build at a live server instead (hot updates, no rebuild),
// set CAP_SERVER_URL and uncomment the server block below.
const config: CapacitorConfig = {
  appId: 'app.exotic.mobile',
  appName: 'Exotic',
  webDir: 'dist',
  backgroundColor: '#09090f',
  ios: {
    contentInset: 'always',
    backgroundColor: '#09090f',
  },
  android: {
    backgroundColor: '#09090f',
  },
  plugins: {
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
    SplashScreen: { backgroundColor: '#09090f', showSpinner: false },
  },
  // server: {
  //   url: process.env.CAP_SERVER_URL, // e.g. https://exotic.app
  //   cleartext: false,
  // },
};

export default config;
