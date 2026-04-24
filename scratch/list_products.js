const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function listProducts() {
  const snapshot = await db.collection('products').limit(5).get();
  snapshot.forEach(doc => {
    console.log(`ID: ${doc.id}, Name: ${doc.data().name}, CustomUnits: ${JSON.stringify(doc.data().customUnits)}`);
  });
}

listProducts().catch(console.error);
