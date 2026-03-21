const admin = require('firebase-admin');
admin.initializeApp({projectId: 'intranet-kihap'});
admin.firestore().collection('mercadopagoAccounts').get().then(s => {
  s.forEach(d => console.log(d.id, d.data()));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
