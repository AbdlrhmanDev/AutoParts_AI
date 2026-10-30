import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppController } from './app/AppController';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppController />
  </React.StrictMode>,
);
