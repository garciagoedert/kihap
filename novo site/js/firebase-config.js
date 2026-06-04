// Importa as funções necessárias do SDK do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";
import { getAuth, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// Importa connectFunctionsEmulator
import { getFunctions, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// Configuração do seu aplicativo da web do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD1WKwAsAicGdRz9cRA2Nvv3LEZve1vZe0",
  authDomain: "intranet-kihap.firebaseapp.com",
  projectId: "intranet-kihap",
  storageBucket: "intranet-kihap.firebasestorage.app",
  messagingSenderId: "1055939458006",
  appId: "1:1055939458006:web:1d67459a0bc0da60cf2a77",
  measurementId: "G-5LP0W3QSVZ",
  vapidKey: "BJzo9uVW8PDIFWv9aYn-fFF6ELnbp8CopuQVs8BO95G0cecYAG6NRr3KZOIZ8SM-ZL5hgy3M9j01mvlBq6tfuuM"
};

// Disponibiliza a VAPID Key globalmente para o sistema de notificações
window.KIHAP_VAPID_KEY = firebaseConfig.vapidKey;

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

let analytics = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
}).catch((err) => console.log("Analytics block omitido:", err));

// Inicializa Autenticação definindo explicitamente a Persistência para não travar no iOS Capacitor (Bug de IndexedDB)
let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence]
  });
} catch (e) {
  // Fallback pra contornar caso o erro seja de recriação
  authInstance = getAuth(app);
}

// Exporta a instância do Firestore, o app e o appId para serem usados em outras partes do aplicativo
export { app };
export const db = getFirestore(app);
export const auth = authInstance;

// Configurar Functions e Emulador
export const functions = getFunctions(app, 'us-central1'); // Especifica a região, se necessário

// Conectar ao emulador se estiver rodando localmente
// Conectar ao emulador se estiver rodando localmente
// if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
//   // Porta padrão do emulador de functions é 5001
//   connectFunctionsEmulator(functions, "localhost", 5001);
//   console.log("📍 Conectado ao Emulador de Functions em localhost:5001");
//   // Porta padrão do emulador de Firestore é 8080
//   connectFirestoreEmulator(db, "localhost", 8080);
//   console.log("📍 Conectado ao Emulador de Firestore em localhost:8080");
// }

export const storage = getStorage(app);
export const appId = firebaseConfig.appId || 'default-kihap-app';
