const admin = require('firebase-admin');
const serviceAccount = require('./intranet-kihap-firebase-adminsdk-fbsvc-43327c2f72.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateProduct() {
  const productRef = db.collection('products').doc('dwILS8bCQ2KTj4CJeXqy');
  await productRef.update({
    isTicket: true
  });
  console.log('Produto atualizado com sucesso!');
}

updateProduct().catch(console.error);
