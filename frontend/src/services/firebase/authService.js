import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile
} from 'firebase/auth';
import { auth } from './firebase';
import { api, setAuthToken } from '../api/apiClient';

export const authService = {
  async login(email, password) {
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    // 1. Authenticate with Express + MongoDB backend
    try {
      const backendRes = await api.post('/api/auth/login', {
        email: cleanEmail,
        password: cleanPassword
      });

      if (backendRes.success && backendRes.token) {
        setAuthToken(backendRes.token);
      }
    } catch (err) {
      console.warn('[AuthService] Backend login sync notification:', err.message);
    }

    // 2. Authenticate with Firebase Auth (client-side state)
    try {
      const res = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      return res;
    } catch (fbErr) {
      console.warn('[AuthService] Firebase login error, verifying if backend already succeeded:', fbErr.message);
      // If backend token exists, allow session
      if (localStorage.getItem('hyperbrain_token')) {
        return {
          user: {
            email: cleanEmail,
            uid: `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
            displayName: cleanEmail.split('@')[0]
          }
        };
      }
      throw fbErr;
    }
  },
  
  async register(email, password, name) {
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    // 1. Register with Express + MongoDB backend
    try {
      const backendRes = await api.post('/api/auth/register', {
        email: cleanEmail,
        password: cleanPassword,
        name: name || cleanEmail.split('@')[0]
      });

      if (backendRes.success && backendRes.token) {
        setAuthToken(backendRes.token);
      }
    } catch (err) {
      console.warn('[AuthService] Backend register sync notification:', err.message);
    }

    // 2. Register with Firebase Auth (client-side state)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      await updateProfile(userCredential.user, { displayName: name });
      return userCredential.user;
    } catch (fbErr) {
      console.warn('[AuthService] Firebase register error:', fbErr.message);
      if (localStorage.getItem('hyperbrain_token')) {
        return {
          email: cleanEmail,
          uid: `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
          displayName: name || cleanEmail.split('@')[0]
        };
      }
      throw fbErr;
    }
  },

  async logout() {
    try {
      await api.post('/api/auth/logout', {});
    } catch (e) {
      // ignore
    }
    setAuthToken(null);
    return signOut(auth).catch(() => {});
  },

  async resetPassword(email) {
    try {
      await api.post('/api/email/send', {
        to: email.trim(),
        type: 'reset-password',
        link: `${window.location.origin}/login`
      });
    } catch (e) {
      // ignore
    }
    return sendPasswordResetEmail(auth, email.trim()).catch(() => {});
  },

  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);

    if (result?.user) {
      try {
        const backendRes = await api.post('/api/auth/google', {
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          uid: result.user.uid
        });
        if (backendRes.success && backendRes.token) {
          setAuthToken(backendRes.token);
        }
      } catch (err) {
        console.warn('[AuthService] Google auth backend sync warning:', err.message);
      }
    }

    return result;
  }
};
