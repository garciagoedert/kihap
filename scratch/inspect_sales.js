const admin = require('firebase-admin');

try {
  admin.initializeApp({ projectId: 'intranet-kihap' });
} catch (e) {
  // Ignore already initialized
}

const db = admin.firestore();

async function inspectSales() {
  console.log('Querying last 5 sales from inscricoesFaixaPreta...');
  const snapshot = await db.collection('inscricoesFaixaPreta')
    .orderBy('created', 'desc')
    .limit(5)
    .get();
  
  if (snapshot.empty) {
    console.log('No sales found.');
    return;
  }

  snapshot.forEach(doc => {
    console.log('--- Sale ID:', doc.id, '---');
    const data = doc.data();
    // Exclude heavy fields if any
    console.log(JSON.stringify(data, null, 2));
  });
}

inspectSales().catch(console.error);
