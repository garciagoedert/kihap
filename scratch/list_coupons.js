const admin = require('firebase-admin');
const serviceAccount = require('../intranet-kihap-firebase-adminsdk-fbsvc-43327c2f72.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function listCoupons() {
  console.log('Fetching coupons...');
  const snapshot = await db.collection('coupons').get();
  if (snapshot.empty) {
    console.log('No coupons found.');
    return;
  }
  
  snapshot.forEach(doc => {
    console.log(doc.id, '=>', doc.data());
  });
}

listCoupons().catch(console.error);
