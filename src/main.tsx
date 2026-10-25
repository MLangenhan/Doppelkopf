import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Schrift vom eigenen Server: keine Anfragen an Google
import '@fontsource-variable/geist';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
