const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Load environment variables from .env file if it exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let val = match[2] || '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      } else if (val.startsWith("'") && val.endsWith("'")) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  }
}

const homeDir = process.env.HOME || '/Users/goedert';
const configPath = path.join(homeDir, '.config', 'configstore', 'firebase-tools.json');

const defaultAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
if (!defaultAccessToken) {
  console.warn('Warning: MERCADOPAGO_ACCESS_TOKEN environment variable is not defined.');
}

async function run() {
  if (!fs.existsSync(configPath)) {
    console.error('Firebase CLI config file not found!');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const tokens = config.tokens || {};
  const accessToken = tokens.access_token;

  if (!accessToken) {
    console.error('No access token found in config.');
    process.exit(1);
  }

  // Fetch MP Accounts
  const mpAccountsMap = {};
  try {
    const accRes = await axios.get(
      'https://firestore.googleapis.com/v1/projects/intranet-kihap/databases/(default)/documents/mercadopagoAccounts',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const accDocs = accRes.data.documents || [];
    accDocs.forEach(d => {
      const parts = d.name.split('/');
      const id = parts[parts.length - 1];
      const fields = d.fields;
      const tok = fields.accessToken?.stringValue;
      let collectorId = '';
      if (tok) {
        const partsTok = tok.split('-');
        collectorId = partsTok[partsTok.length - 1];
      }
      mpAccountsMap[collectorId] = {
        token: tok,
        label: fields.label?.stringValue || id
      };
    });
  } catch (err) {
    console.warn('Could not fetch MP accounts list:', err.message);
  }

  const defaultCollectorId = defaultAccessToken.split('-').pop();
  mpAccountsMap[defaultCollectorId] = {
    token: defaultAccessToken,
    label: 'Matriz (Default)'
  };

  // Test with first subscription ID: 1563097303-2f1d1aca-6a59-4d9c-a7f4-5fd8503cccd2
  const testId = '1563097303-2f1d1aca-6a59-4d9c-a7f4-5fd8503cccd2';
  const collectorId = testId.split('-')[0];
  const token = mpAccountsMap[collectorId]?.token || defaultAccessToken;

  console.log(`Testing ID: ${testId} with token of collector: ${collectorId} (${mpAccountsMap[collectorId]?.label})`);

  // Try Preference endpoint
  try {
    const res = await axios.get(`https://api.mercadopago.com/checkout/preferences/${testId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('--- Success querying Preference endpoint ---');
    console.log('Title/Reason:', res.data.items?.[0]?.title);
    console.log('Total Amount:', res.data.items?.[0]?.unit_price);
    console.log('Payer:', res.data.payer);
    console.log('Metadata/External Ref:', res.data.external_reference);
  } catch (err) {
    console.log('Error querying Preference endpoint:', err.response?.data || err.message);
  }

  // Try Preapproval endpoint
  try {
    const res = await axios.get(`https://api.mercadopago.com/preapproval/${testId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('--- Success querying Preapproval endpoint ---');
    console.log('Reason:', res.data.reason);
    console.log('Status:', res.data.status);
  } catch (err) {
    console.log('Error querying Preapproval endpoint:', err.response?.data || err.message);
  }
}

run();
