import { initializeAppWithFirebase } from './arquivo.js';

const firebaseConfig = {
    apiKey: "AIzaSyD1WKwAsAicGdRz9cRA2Nvv3LEZve1vZe0",
    authDomain: "intranet-kihap.firebaseapp.com",
    projectId: "intranet-kihap",
    storageBucket: "intranet-kihap.firebasestorage.app",
    messagingSenderId: "1055939458006",
    appId: "1:1055939458006:web:1d67459a0bc0da60cf2a77",
    measurementId: "G-5LP0W3QSVZ"
};

initializeAppWithFirebase(firebaseConfig);
