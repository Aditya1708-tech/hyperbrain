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

export const authService = {
  async login(email, password) {
    return signInWithEmailAndPassword(auth, email.trim(), password.trim());
  },
  
  async register(email, password, name) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: name });
    return userCredential.user;
  },

  async logout() {
    return signOut(auth);
  },

  async resetPassword(email) {
    return sendPasswordResetEmail(auth, email.trim());
  },

  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return signInWithPopup(auth, provider);
  }
};
