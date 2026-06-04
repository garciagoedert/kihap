importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

// O Firebase Config deve ser o mesmo usado no frontend
// Idealmente carregar de um arquivo comum, mas em service workers costumamos duplicar ou carregar via importScripts
firebase.initializeApp({
    apiKey: "AIzaSyD1WKwAsAicGdRz9cRA2Nvv3LEZve1vZe0",
    authDomain: "intranet-kihap.firebaseapp.com",
    projectId: "intranet-kihap",
    storageBucket: "intranet-kihap.firebasestorage.app",
    messagingSenderId: "1055939458006",
    appId: "1:1055939458006:web:1d67459a0bc0da60cf2a77"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensagem recebida em background ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/imgs/logo.png', // Logo da Kihap
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const link = event.notification.data?.link || '/intranet/index.html';
    event.waitUntil(
        clients.openWindow(link)
    );
});
