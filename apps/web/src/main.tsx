import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

const root = document.getElementById('root');
if (!root) throw new Error('Root element is missing');
const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
createRoot(root).render(
  <StrictMode>
    <App apiUrl={apiUrl} />
  </StrictMode>,
);
