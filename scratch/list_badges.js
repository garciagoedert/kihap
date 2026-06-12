const admin = require('firebase-admin');
const serviceAccount = require('../intranet-kihap-firebase-adminsdk-fbsvc-43327c2f72.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  console.log("=== BADGES IN FIRESTORE ===");
  const badgesSnap = await db.collection('badges').get();
  badgesSnap.forEach(doc => {
    console.log(doc.id, "=>", doc.data());
  });

  console.log("\n=== USER DATA SAMPLES (earnedBadges) ===");
  const usersSnap = await db.collection('users').limit(10).get();
  usersSnap.forEach(doc => {
    const data = doc.data();
    if (data.earnedBadges && data.earnedBadges.length > 0) {
      console.log(doc.id, data.name, "=> earnedBadges:", data.earnedBadges);
    }
  });
}

run().catch(console.error);
