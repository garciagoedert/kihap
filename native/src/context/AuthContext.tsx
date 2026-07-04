import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithCustomToken } from 'firebase/auth';
import { auth, db, functions } from '../services/firebase';
import { doc, onSnapshot, query, collection, where, documentId } from 'firebase/firestore';
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
    const profilesMap = new Map<string, any>();

    const updateProfiles = () => {
      profilesMap.delete(userData.uid);
      setLinkedProfiles(Array.from(profilesMap.values()));
    };

    const handleQuerySnapshot = (snap: any, roleFlags: { isParent?: boolean; isChild?: boolean }) => {
      snap.docChanges().forEach((change: any) => {
        const docId = change.doc.id;
        if (change.type === 'removed') {
          profilesMap.delete(docId);
        } else {
          profilesMap.set(docId, {
            uid: docId,
            ...roleFlags,
            ...change.doc.data()
          });
        }
      });
      updateProfiles();
    };

    // 1. Watch primary parent if defined
    if (userData.parentUid) {
      const unsubParent = onSnapshot(doc(db, 'users', userData.parentUid), (parentSnap) => {
        if (parentSnap.exists()) {
          profilesMap.set(userData.parentUid, {
            uid: userData.parentUid,
            isParent: true,
            ...parentSnap.data()
          });
        } else {
          profilesMap.delete(userData.parentUid);
        }
        updateProfiles();
      }, (err) => {
        console.error("Auth: Error watching parent document:", err);
      });
      unsubscribes.push(unsubParent);

      // Watch siblings (all children of the same parent)
      const qSiblings = query(collection(db, 'users'), where('parentUid', '==', userData.parentUid));
      const unsubSiblings = onSnapshot(qSiblings, (snap) => {
        handleQuerySnapshot(snap, { isChild: true });
      }, (err) => {
        console.error("Auth: Error watching siblings:", err);
      });
      unsubscribes.push(unsubSiblings);
    }

    // 2. Watch any parents who have this user in their linkedUids
    const qParentsByLinked = query(collection(db, 'users'), where('linkedUids', 'array-contains', userData.uid));
    const unsubParentsByLinked = onSnapshot(qParentsByLinked, (snap) => {
      handleQuerySnapshot(snap, { isParent: true });
    }, (err) => {
      console.error("Auth: Error watching parents by linkedUids:", err);
    });
    unsubscribes.push(unsubParentsByLinked);

    // 3. Watch children where parentUid == userData.uid
    const qChildrenByParentUid = query(collection(db, 'users'), where('parentUid', '==', userData.uid));
    const unsubChildrenByParentUid = onSnapshot(qChildrenByParentUid, (snap) => {
      handleQuerySnapshot(snap, { isChild: true });
    }, (err) => {
      console.error("Auth: Error watching children by parentUid:", err);
    });
    unsubscribes.push(unsubChildrenByParentUid);

    // 4. Watch children in userData.linkedUids
    if (Array.isArray(userData.linkedUids) && userData.linkedUids.length > 0) {
      const qChildrenByList = query(collection(db, 'users'), where(documentId(), 'in', userData.linkedUids));
      const unsubChildrenByList = onSnapshot(qChildrenByList, (snap) => {
        handleQuerySnapshot(snap, { isChild: true });
      }, (err) => {
        console.error("Auth: Error watching children by linkedUids list:", err);
      });
      unsubscribes.push(unsubChildrenByList);
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
