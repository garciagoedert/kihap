const fs = require('fs');
const path = require('path');
const axios = require('axios');

const homeDir = process.env.HOME || '/Users/goedert';
const configPath = path.join(homeDir, '.config', 'configstore', 'firebase-tools.json');

if (!fs.existsSync(configPath)) {
  console.error('Config file not found!');
  process.exit(1);
}

try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const tokens = config.tokens || {};
  const accessToken = tokens.access_token;

  if (!accessToken) {
    console.error('No access token found in config.');
    process.exit(1);
  }

  const userId = 'rWSqcxnTwAgAOfgQ9F8APXgzQJv1';
  console.log(`Checking subscriptions for user ${userId}...`);

  axios.get(
    `https://firestore.googleapis.com/v1/projects/intranet-kihap/databases/(default)/documents/users/${userId}/subscriptions`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  ).then(res => {
    const docs = res.data.documents || [];
    console.log(`Found ${docs.length} subscriptions.`);
    docs.forEach((doc, idx) => {
      const name = doc.name;
      const fields = doc.fields;
      console.log(`\n[Doc ${idx + 1}] name: ${name}`);
      console.log(`courseId: ${fields.courseId?.stringValue}`);
      console.log(`status: ${fields.status?.stringValue}`);
      console.log(`paymentMethod: ${fields.paymentMethod?.stringValue}`);
      console.log(`mercadoPagoPreferenceId: ${fields.mercadoPagoPreferenceId?.stringValue}`);
      console.log(`mpPreapprovalId: ${fields.mpPreapprovalId?.stringValue}`);
    });
  }).catch(err => {
    console.error('Error querying Firestore REST API:', err.response?.data || err.message);
  });

} catch (err) {
  console.error('Failed to parse config:', err);
}
