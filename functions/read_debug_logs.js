const admin = require("firebase-admin");

// Initialize Admin SDK pointing to emulator
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.GCLOUD_PROJECT = "intranet-kihap";

if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: "intranet-kihap" });
}

const db = admin.firestore();

async function readLogs() {
    console.log("Reading debug_evo_logs...");
    try {
        const snapshot = await db.collection('debug_evo_logs')
            .orderBy('timestamp', 'desc')
            .limit(50)
            .get();

        if (snapshot.empty) {
            console.log("No logs found.");
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`[${doc.id}] Action: ${data.action} | Unit: ${data.unit || 'N/A'} | Count: ${data.count || 'N/A'} | Error: ${data.error || 'N/A'}`);
        });

    } catch (error) {
        console.error("Error reading logs:", error);
    }
}

readLogs();
