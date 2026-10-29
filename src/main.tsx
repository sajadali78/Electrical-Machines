import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DesignProvider } from './state/store';
import './styles/tokens.css';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesignProvider>
      <App />
    </DesignProvider>
  </StrictMode>,
);
