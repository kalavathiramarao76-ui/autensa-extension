import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AuthWall } from '../shared/AuthWall';
import '../ui/styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <AuthWall>
    <App />
  </AuthWall>
);
