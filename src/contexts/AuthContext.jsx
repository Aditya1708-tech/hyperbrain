import React, {
  createContext,
  useContext,
  useState,
  useEffect
} from "react";

import { auth } from "../services/firebase/firebase";
import { db } from "../services/firebase/firebase";

import { doc, getDoc } from "firebase/firestore";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    const unsubscribe = auth.onAuthStateChanged(
      async (user) => {

        setCurrentUser(user);

        if (user) {
          try {

            const userRef = doc(
              db,
              "users",
              user.uid
            );

            const snap = await getDoc(
              userRef
            );

            console.log(
              "User document exists:",
              snap.exists()
            );

            if (snap.exists()) {

              console.log(
                "Profile:",
                snap.data()
              );

              setUserProfile(
                snap.data()
              );

            } else {

              console.log(
                "No profile found"
              );

              // temporary admin bypass
              if (
                user.email ===
                "aditya@hyperbrain.ai"
              ) {
                setUserProfile({
                  role: "Administrator"
                });
              }
            }

          } catch (err) {

            console.error(
              "Profile error:",
              err
            );
          }
        } else {
          setUserProfile(null);
        }

        setLoading(false);
      }
    );

    return unsubscribe;

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

export const useAuth = () =>
  useContext(AuthContext);