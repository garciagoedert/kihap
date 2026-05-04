import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyD1WKwAsAicGdRz9cRA2Nvv3LEZve1vZe0",
  authDomain: "intranet-kihap.firebaseapp.com",
  projectId: "intranet-kihap",
  storageBucket: "intranet-kihap.firebasestorage.app",
  messagingSenderId: "1055939458006",
  appId: "1:1055939458006:web:1d67459a0bc0da60cf2a77",
};

console.log("Firebase: Checking if app exists...");
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
console.log("Firebase: App initialized:", app.name);

console.log("Firebase: Initializing Auth...");
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  console.log("Firebase: Auth already initialized, using getAuth.");
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');

console.log("Firebase: Services initialized successfully.");

export default app;
