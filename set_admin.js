
const admin = require('firebase-admin');

// Connect to local emulator
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

admin.initializeApp({
    projectId: "intranet-kihap"
});

const db = admin.firestore();

async function setAdmin() {
    const emailToPromote = 'comercial@kihap.com.br';
    const uid = 'L3JC51UCaagq7QEl1eTfZBZBEZg2'; // Found in logs

    console.log(`Setting admin for user ${emailToPromote} (UID: ${uid})...`);

    try {
        const userRef = db.collection('users').doc(uid);
        const doc = await userRef.get();

        if (doc.exists) {
            console.log(`User document exists. Updating isAdmin: true...`);
            await userRef.update({ isAdmin: true });
        } else {
            console.log(`User document does not exist. Creating with isAdmin: true...`);
            await userRef.set({
                name: 'Comercial', // Default name
                email: emailToPromote,
                isAdmin: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        console.log('Successfully set admin permissions.');
    } catch (error) {
        console.error('Error setting admin:', error);
    }
}

setAdmin().catch(console.error);
