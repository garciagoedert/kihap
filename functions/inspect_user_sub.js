const admin = require('firebase-admin');
const serviceAccount = require('../intranet-kihap-firebase-adminsdk-fbsvc-43327c2f72.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function main() {
  const userId = 'rWSqcxnTwAgAOfgQ9F8APXgzQJv1';
  console.log(`Querying subscriptions subcollection for user: ${userId}...`);
  
  const snapshot = await db.collection('users').doc(userId).collection('subscriptions').get();
  console.log(`Found ${snapshot.size} subscription documents.`);
  
  snapshot.docs.forEach((doc, idx) => {
    console.log(`\n[Subscription ${idx+1}] ID: ${doc.id}`);
    console.log(JSON.stringify(doc.data(), null, 2));
  });
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
