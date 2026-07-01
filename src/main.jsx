import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';

import { AI_CONFIG } from './config/aiConfig';

console.log("ENV CHECK:", {
   groq: !!AI_CONFIG.apiKey,
   firebase: !!import.meta.env.VITE_FIREBASE_API_KEY
});

if (!AI_CONFIG.apiKey) {
  console.error("Missing GROQ API key");
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <SubscriptionProvider>
        <App />
      </SubscriptionProvider>
    </AuthProvider>
  </StrictMode>
);
