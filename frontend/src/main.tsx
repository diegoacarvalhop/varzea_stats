import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppToaster } from '@/components/AppToaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppRoutes } from '@/routes/AppRoutes';
import '@/styles/global.scss';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <AppToaster />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
