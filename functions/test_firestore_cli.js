const fs = require('fs');
const path = require('path');
const axios = require('axios');

const homeDir = process.env.HOME || '/Users/goedert';
const configPath = path.join(homeDir, '.config', 'configstore', 'firebase-tools.json');

console.log('Reading config from:', configPath);

if (!fs.existsSync(configPath)) {
  console.error('Config file not found!');
  process.exit(1);
}

try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const tokens = config.tokens || {};
  const accessToken = tokens.access_token;
  const refreshToken = tokens.refresh_token;

  console.log('Access Token exists:', !!accessToken);
  console.log('Refresh Token exists:', !!refreshToken);
  
  if (!accessToken) {
    console.error('No access token found in config.');
    process.exit(1);
  }

  // Query Firestore using the REST API
  console.log('Querying Firestore REST API for active subscriptions in inscricoesFaixaPreta...');
  axios.post(
    'https://firestore.googleapis.com/v1/projects/intranet-kihap/databases/(default)/documents:runQuery',
    {
      structuredQuery: {
        from: [{ collectionId: 'inscricoesFaixaPreta' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'isSubscription' },
            op: 'EQUAL',
            value: { booleanValue: true }
          }
        },
        limit: 10
      }
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  ).then(res => {
    const docs = res.data || [];
    console.log(`Found ${docs.length} subscriptions in Firestore.`);
    docs.forEach((doc, idx) => {
      if (!doc.document) return;
      const fields = doc.document.fields;
      console.log(`\n[Subscription ${idx + 1}]`);
      console.log(`ID: ${doc.document.name.split('/').pop()}`);
      console.log(`User: ${fields.userName?.stringValue}`);
      console.log(`Email: ${fields.userEmail?.stringValue}`);
      console.log(`Product: ${fields.productName?.stringValue}`);
      console.log(`Status: ${fields.paymentStatus?.stringValue}`);
      console.log(`Preapproval ID: ${fields.mercadoPagoPreferenceId?.stringValue}`);
    });
  }).catch(err => {
    console.error('Error querying Firestore REST API:', err.response?.data || err.message);
  });

} catch (err) {
  console.error('Failed to parse config:', err);
}
