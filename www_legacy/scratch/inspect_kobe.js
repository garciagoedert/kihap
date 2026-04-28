const admin = require('firebase-admin');
const serviceAccount = require('../intranet-kihap-firebase-adminsdk-fbsvc-43327c2f72.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function inspectKobe() {
  console.log('Searching for users named Kobe...');
  const snapshot = await db.collection('users').where('name', '>=', 'Kobe').where('name', '<=', 'Kobe\uf8ff').get();
  
  if (snapshot.empty) {
    console.log('No users found with name Kobe.');
    return;
  }

  snapshot.forEach(doc => {
    console.log('--- User Found ---');
    console.log('ID:', doc.id);
    console.log('Data:', JSON.stringify(doc.data(), null, 2));
  });
}

inspectKobe().catch(console.error);
