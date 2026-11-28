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
import { App } from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
