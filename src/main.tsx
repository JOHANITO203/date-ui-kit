import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';

// Local font embedding for deterministic cross-device rendering
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';
import '@fontsource/inter/cyrillic-400.css';
import '@fontsource/inter/cyrillic-500.css';
import '@fontsource/inter/cyrillic-600.css';
import '@fontsource/inter/cyrillic-700.css';
import '@fontsource/inter/cyrillic-800.css';
import '@fontsource/inter/cyrillic-900.css';
import '@fontsource/inter/cyrillic-ext-400.css';
import '@fontsource/inter/cyrillic-ext-500.css';
import '@fontsource/inter/cyrillic-ext-600.css';
import '@fontsource/inter/cyrillic-ext-700.css';
import '@fontsource/inter/cyrillic-ext-800.css';
import '@fontsource/inter/cyrillic-ext-900.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import './index.css';
import { I18nProvider } from './i18n/I18nProvider';
import { AuthProvider } from './auth/AuthProvider';
import { initMonitoring } from './services/monitoring';
import { runtimeApi } from './state/appRuntimeStore';
import { registerSW } from 'virtual:pwa-register';
import { initNativeShell } from './utils/native';

initMonitoring();

// Register the service worker (app-shell precache + image cache). autoUpdate
// pulls new builds in the background; immediate claims the page on first load.
registerSW({ immediate: true });

// Configure native chrome when running inside Capacitor (no-op as a PWA).
void initNativeShell();

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search);
  if (params.get('bench') === '1') {
    runtimeApi.seedDemo();
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
);
