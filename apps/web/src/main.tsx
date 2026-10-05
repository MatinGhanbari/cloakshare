import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Login from './pages/Login';
import Register from './pages/Register';
import Links from './pages/Links';
import Upload from './pages/Upload';
import Groups from './pages/Groups';
import LinkDetail from './pages/LinkDetail';
import ApiKeys from './pages/ApiKeys';
import Settings from './pages/Settings';
import Billing from './pages/Billing';
import Team from './pages/Team';
import AuditLog from './pages/AuditLog';
import DashboardLayout from './components/DashboardLayout';
import { initTheme } from './lib/theme';
import './index.css';

// Apply the stored light/dark preference before the first paint.
initTheme();

// Initialize PostHog if configured
const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

if (posthogKey) {
  import('posthog-js').then(({ default: posthog }) => {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      capture_pageview: true,
      capture_pageleave: true,
    });
    window.posthog = posthog;
  }).catch(() => {
    // PostHog failed to load - continue without analytics
  });
}


function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center bg-background"><div className="w-6 h-6 border-2 border-border border-t-accent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/dashboard">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            {/* The index route redirects so the navigation rail always has an active item.
                Before this, landing on `/` rendered Links while no nav entry was highlighted. */}
            <Route index element={<Navigate to="/links" replace />} />
            <Route path="links" element={<Links />} />
            <Route path="upload" element={<Upload />} />
            <Route path="groups" element={<Groups />} />
            <Route path="links/:id" element={<LinkDetail />} />
            <Route path="api-keys" element={<ApiKeys />} />
            <Route path="team" element={<Team />} />
            <Route path="audit-log" element={<AuditLog />} />
            <Route path="billing" element={<Billing />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
