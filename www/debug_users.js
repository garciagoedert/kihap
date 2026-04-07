
const admin = require('firebase-admin');

// Connect to local emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({
    projectId: "intranet-kihap"
});

const db = admin.firestore();

async function listUsers() {
    console.log('Listing users from local Firestore...');
    const snapshot = await db.collection('users').limit(10).get();

    if (snapshot.empty) {
        console.log('No users found in "users" collection.');
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`User ID: ${doc.id}`);
        console.log(`  Name: ${data.name}`);
        console.log(`  evoMemberId: ${data.evoMemberId} (Type: ${typeof data.evoMemberId})`);
    });
}

listUsers().catch(console.error);
