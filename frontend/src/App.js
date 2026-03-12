// ============================================
// App.js — GmailCall Root Component
// Handles routing between pages
// ============================================

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import LoginPage from './pages/LoginPage';
import OTPPage from './pages/OTPPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import './index.css';

// ─── Inner app (needs AuthContext) ────────────────────────────────────────────
const AppInner = () => {
  const { user, loading } = useAuth();
  const [authStep, setAuthStep] = useState('login'); // 'login' | 'otp'
  const [pendingEmail, setPendingEmail] = useState('');
  const [currentPage, setCurrentPage] = useState('dashboard'); // 'dashboard' | 'profile'

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{ fontSize: 40 }}>📞</div>
        <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          Loading GmailCall...
        </div>
        <div className="spinner" style={{ marginTop: 8 }} />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    if (authStep === 'otp') {
      return (
        <OTPPage
          email={pendingEmail}
          onBack={() => setAuthStep('login')}
        />
      );
    }
    return (
      <LoginPage
        onOTPSent={(email) => {
          setPendingEmail(email);
          setAuthStep('otp');
        }}
      />
    );
  }

  // Authenticated — wrap with Socket provider
  return (
    <SocketProvider>
      {currentPage === 'profile' ? (
        <ProfilePage onBack={() => setCurrentPage('dashboard')} />
      ) : (
        <DashboardPage onProfileClick={() => setCurrentPage('profile')} />
      )}
    </SocketProvider>
  );
};

// ─── Root App ─────────────────────────────────────────────────────────────────
const App = () => (
  <AuthProvider>
    <AppInner />
  </AuthProvider>
);

export default App;
