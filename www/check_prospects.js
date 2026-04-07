const admin = require('firebase-admin');
const serviceAccount = require('./functions/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

db.collection('prospects')
  .orderBy('createdAt', 'desc')
  .limit(5)
  .get()
  .then(snapshot => {
    console.log(`\nÚltimos ${snapshot.size} prospects:`);
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\n- ID: ${doc.id}`);
      console.log(`  Telefone: ${data.telefone}`);
      console.log(`  Status: ${data.status}`);
      console.log(`  Origem: ${data.origemLead}`);
      console.log(`  Criado: ${data.createdAt?.toDate?.() || 'N/A'}`);
    });
    process.exit(0);
  })
  .catch(err => {
    console.error('[Erro]', err);
    process.exit(1);
  });
