const admin = require('firebase-admin');
const serviceAccount = require('../intranet-kihap-firebase-adminsdk-fbsvc-43327c2f72.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  console.log('Searching by CPF: 90910389934');
  const snap1 = await db.collection('inscricoesFaixaPreta').where('userCpf', '==', '90910389934').get();
  console.log(`Found ${snap1.size} docs with exact CPF`);
  snap1.forEach(d => console.log(d.id, d.data().userName, d.data().userCpf));

  console.log('\nSearching by name: Giovanni');
  const snap2 = await db.collection('inscricoesFaixaPreta').get();
  console.log(`Total docs in inscricoesFaixaPreta: ${snap2.size}`);
  let count = 0;
  snap2.forEach(d => {
    const data = d.data();
    const name = (data.userName || '').toLowerCase();
    const cpf = (data.userCpf || '');
    if (name.includes('giovanni') || cpf.includes('90910389934')) {
      count++;
      console.log('Match:', d.id, 'Name:', data.userName, 'CPF:', data.userCpf, 'Email:', data.userEmail);
    }
  });
  console.log(`Total matches in entire collection: ${count}`);
}

run().catch(console.error);
