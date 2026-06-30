import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';

console.log("ENV CHECK:", {
   gemini: !!import.meta.env.VITE_GEMINI_API_KEY,
   firebase: !!import.meta.env.VITE_FIREBASE_API_KEY
});

if (!import.meta.env.VITE_GEMINI_API_KEY) {
  console.error("Missing Gemini API key");
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
