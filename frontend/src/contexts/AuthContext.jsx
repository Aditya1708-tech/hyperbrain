import React, {
  createContext,
  useContext,
  useState,
  useEffect
} from "react";

import { auth, db } from "../services/firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import { api } from "../services/api/apiClient";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync session with Express + MongoDB backend
  const syncBackendSession = async (user) => {
    try {
      const res = await api.get('/api/auth/me');
      if (res && res.success && res.user) {
        setUserProfile(res.user);
        if (!user) {
          setCurrentUser({
            uid: res.user.uid || res.user.id,
            email: res.user.email,
            displayName: res.user.displayName || res.user.name,
            role: res.user.role
          });
        }
        return true;
      }
    } catch (e) {
      // Backend token expired or not set
    }
    return false;
  };

  useEffect(() => {
    let isMounted = true;

    // First attempt backend token check
    syncBackendSession(null).finally(() => {
      if (isMounted && !auth) {
        setLoading(false);
      }
    });

    const unsubscribe = auth?.onAuthStateChanged?.(
      async (user) => {
        if (!isMounted) return;
        setCurrentUser(user);

        if (user) {
          try {
            // First try MongoDB/Express user profile
            const synced = await syncBackendSession(user);
            if (!synced) {
              const userRef = doc(db, "users", user.uid);
              const snap = await getDoc(userRef);

              if (snap && snap.exists()) {
                setUserProfile(snap.data());
              } else {
                if (user.email === "aditya@hyperbrain.ai") {
                  setUserProfile({ role: "Administrator" });
                } else {
                  setUserProfile({ role: "Student", email: user.email, name: user.displayName });
                }
              }
            }
          } catch (err) {
            console.error("Profile sync error:", err);
          }
        } else {
          // If no Firebase user, check if we still have backend session
          await syncBackendSession(null);
        }

        if (isMounted) setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);