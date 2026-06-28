const admin = require('firebase-admin');
const serviceAccount = require('../intranet-kihap-firebase-adminsdk-fbsvc-43327c2f72.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function main() {
  console.log("Querying top 10 users with currentStreak > 0...");
  const snap = await db.collection('users')
    .where('currentStreak', '>', 0)
    .orderBy('currentStreak', 'desc')
    .limit(20)
    .get();

  console.log(`Found ${snap.size} users.`);
  snap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`- ${data.name || data.nome || 'No Name'} (ID: ${doc.id}): currentStreak=${data.currentStreak}, longestStreak=${data.longestStreak}, lastAttendanceDate=${data.lastAttendanceDate}, streak=${data.streak}, currentStreakDays=${data.currentStreakDays}`);
  });
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
