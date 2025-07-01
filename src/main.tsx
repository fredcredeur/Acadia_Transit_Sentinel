<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 05667b0be0c30bc14cee79015ab4a93fba3d4068
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ToastProvider } from './hooks/useToast';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>
);
<<<<<<< HEAD
=======
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
>>>>>>> 3c24d9e62665244f95ff965ed5fc261ce073a64a
=======
>>>>>>> 05667b0be0c30bc14cee79015ab4a93fba3d4068
