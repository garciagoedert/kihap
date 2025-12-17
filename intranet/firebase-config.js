// Importa as funções necessárias do SDK do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
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
  measurementId: "G-5LP0W3QSVZ"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Exporta a instância do Firestore, o app e o appId para serem usados em outras partes do aplicativo
export { app };
export const db = getFirestore(app);
export const auth = getAuth(app);

// Configurar Functions e Emulador
export const functions = getFunctions(app, 'us-central1'); // Especifica a região, se necessário

// Conectar ao emulador se estiver rodando localmente
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
  // Porta padrão do emulador de functions é 5001
  connectFunctionsEmulator(functions, "localhost", 5001);
  console.log("📍 Conectado ao Emulador de Functions em localhost:5001");
}

export const storage = getStorage(app);
export const appId = firebaseConfig.appId || 'default-kihap-app';
