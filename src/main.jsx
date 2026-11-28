import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces/opsz.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/auth.css';
import './styles/landing.css';
import './styles/app.css';
import './styles/chat.css';
import './styles/responsive.css';
import './styles/performance.css';
import { hydratePreferences } from './lib/preferences.js';
import { App } from './App.jsx';

// Apply saved device preferences (motion, latency, GPU effects, ambient
// background) before the first render so there is no flash of full effects.
hydratePreferences();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
