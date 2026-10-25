import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Schrift vom eigenen Server: keine Anfragen an Google
import '@fontsource-variable/geist';
import '@fontsource/big-shoulders-display/700';
import '@fontsource/big-shoulders-display/800';
import '@fontsource/ibm-plex-mono/400';
import '@fontsource/ibm-plex-mono/500';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
