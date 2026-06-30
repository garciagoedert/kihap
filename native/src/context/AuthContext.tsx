import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithCustomToken } from 'firebase/auth';
import { auth, db, functions } from '../services/firebase';
import { doc, onSnapshot, query, collection, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

interface AuthContextType {
  user: User | null;
  userData: any | null;
  loading: boolean;
  linkedProfiles: any[];
  switchProfile: (targetUid: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  linkedProfiles: [],
  switchProfile: async () => {},
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [linkedProfiles, setLinkedProfiles] = useState<any[]>([]);
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

  // Listen to linked profiles in real-time
  useEffect(() => {
    if (!userData) {
      setLinkedProfiles([]);
      return;
    }

    const unsubscribes: (() => void)[] = [];

    // Helper to watch parent and siblings
    const watchParentAndSiblings = (parentUid: string) => {
      // 1. Watch parent
      const unsubParent = onSnapshot(doc(db, 'users', parentUid), (parentSnap) => {
        if (parentSnap.exists()) {
          const parentData = parentSnap.data();
          setLinkedProfiles(prev => {
            const others = prev.filter(p => p.uid !== parentUid);
            return [{ uid: parentUid, isParent: true, ...parentData }, ...others];
          });
        }
      });
      unsubscribes.push(unsubParent);

      // 2. Watch siblings (all children of same parent, excluding current user)
      const qSiblings = query(collection(db, 'users'), where('parentUid', '==', parentUid));
      const unsubSiblings = onSnapshot(qSiblings, (snap) => {
        const siblings: any[] = [];
        snap.forEach(docSnap => {
          if (docSnap.id !== userData.uid) {
            siblings.push({ uid: docSnap.id, isChild: true, ...docSnap.data() });
          }
        });
        setLinkedProfiles(prev => {
          const parentOnly = prev.filter(p => p.uid === parentUid);
          return [...parentOnly, ...siblings];
        });
      });
      unsubscribes.push(unsubSiblings);
    };

    // If current user is a child (has a parentUid)
    if (userData.parentUid) {
      watchParentAndSiblings(userData.parentUid);
    } 
    // If current user is a parent (or standard user)
    else {
      // Watch all children
      const qChildren = query(collection(db, 'users'), where('parentUid', '==', userData.uid));
      const unsubChildren = onSnapshot(qChildren, (snap) => {
        const children: any[] = [];
        snap.forEach(docSnap => {
          children.push({ uid: docSnap.id, isChild: true, ...docSnap.data() });
        });
        setLinkedProfiles(children);
      });
      unsubscribes.push(unsubChildren);
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [userData]);

  const switchProfile = async (targetUid: string) => {
    setLoading(true);
    try {
      const getSwitchProfileToken = httpsCallable(functions, 'getSwitchProfileToken');
      const result = await getSwitchProfileToken({ targetUid });
      const data = result.data as { success: boolean; customToken: string };
      
      if (data && data.customToken) {
        await signInWithCustomToken(auth, data.customToken);
      } else {
        throw new Error("Token de alternância inválido retornado pelo servidor.");
      }
    } catch (error) {
      console.error("Erro ao alternar perfil:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOutUser = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, linkedProfiles, switchProfile, signOut: signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
