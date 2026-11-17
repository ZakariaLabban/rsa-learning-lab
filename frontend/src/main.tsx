import React from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App';
import { OfflineStatus } from './offline/OfflineStatus';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
      <OfflineStatus />
    </MotionConfig>
  </React.StrictMode>,
);
