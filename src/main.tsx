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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
