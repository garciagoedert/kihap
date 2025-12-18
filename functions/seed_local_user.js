
const admin = require('firebase-admin');
const axios = require('axios');
const https = require('https');

// Connect to local emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({
    projectId: "intranet-kihap"
});

const db = admin.firestore();

// Copied from evo.js
const EVO_CREDENTIALS = {
    centro: {
        dns: "atadf",
        token: "08AD03F4-B0A7-4B4B-958C-38C81EA66E48",
    }
};

function getEvoApiClient(unitId) {
    const credentials = EVO_CREDENTIALS[unitId];
    const httpsAgent = new https.Agent({ family: 4 });
    return axios.create({
        baseURL: `https://evo-integracao-api.w12app.com.br/api/v2`,
        headers: {
            "Authorization": `Basic ${Buffer.from(`${credentials.dns}:${credentials.token}`).toString("base64")}`,
            "Content-Type": "application/json"
        },
        httpsAgent: httpsAgent
    });
}

async function seedUser() {
    try {
        console.log('Waiting 5 seconds to cool down rate limits...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('Fetching active students from EVO API (Centro)...');
        const apiClient = getEvoApiClient('centro');

        // Fetch 50 students
        const response = await apiClient.get("/members", {
            params: {
                take: 50,
                status: 1, // Active
                showContacts: true
            }
        });

        const members = response.data;
        if (!members || members.length === 0) {
            console.error('No members found in EVO API.');
            return;
        }

        console.log(`Found ${members.length} members. Seeding local Firestore...`);

        const batch = db.batch();
        let count = 0;

        for (const member of members) {
            // Basic validation
            if (!member.idMember || !member.firstName) continue;

            // Generate email or use dummy if missing
            const email = member.email || (member.contacts && member.contacts.find(c => c.contactType === 'E-mail')?.description) || `test-${member.idMember}@kihap.com.br`;

            // Generate UID
            const uid = 'test-user-' + member.idMember;
            const userRef = db.collection('users').doc(uid);

            batch.set(userRef, {
                name: `${member.firstName} ${member.lastName || ''}`.trim(),
                email: email,
                evoMemberId: member.idMember, // Number matches API
                unitId: 'centro',
                isAdmin: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            count++;
        }

        await batch.commit();

        console.log(`Successfully seeded ${count} users into local Firestore!`);
        console.log('---------------------------------------------------');
        console.log(`PLEASE RELOAD THE ALUNOS PAGE.`);
        console.log(`You should see multiple students highlighted in blue.`);

    } catch (error) {
        console.error('Error seeding user:', error.message);
        if (error.response) {
            console.error('API Response:', error.response.status, error.response.data);
        }
    }
}

seedUser();
