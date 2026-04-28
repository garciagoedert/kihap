import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  userData: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("Auth: Provider useEffect started.");
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      console.log("Auth: onAuthStateChanged fired, user:", firebaseUser ? firebaseUser.uid : "null");
      setUser(firebaseUser);
      
      if (firebaseUser) {
        console.log("Auth: User logged in, fetching Firestore document...");
        
        const unsubscribeDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("Auth: User Firestore data found.");
            setUserData({ uid: firebaseUser.uid, ...data });
          } else {
            console.log("Auth: No user document found in Firestore.");
            setUserData(null);
          }
          setLoading(false);
          console.log("Auth: Loading complete (user found).");
        }, (error) => {
          console.error("Auth: Firestore snapshot error:", error);
          setLoading(false);
        });

        return () => unsubscribeDoc();
      } else {
        console.log("Auth: No user found.");
        setUserData(null);
        setLoading(false);
        console.log("Auth: Loading complete (no user).");
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const signOutUser = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, signOut: signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
