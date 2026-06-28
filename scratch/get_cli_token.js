const fs = require('fs');
const path = require('path');
const axios = require('axios');

const homeDir = process.env.HOME || '/Users/goedert';
const configPath = path.join(homeDir, '.config', 'configstore', 'firebase-tools.json');

if (!fs.existsSync(configPath)) {
  console.error('Config file not found!');
  process.exit(1);
}

async function main() {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const tokens = config.tokens || {};
  const refreshToken = tokens.refresh_token;

  if (!refreshToken) {
    console.error('No refresh token found.');
    process.exit(1);
  }

  console.log('Exchanging refresh token for access token...');
  
  const response = await axios.post('https://oauth2.googleapis.com/token', {
    grant_type: 'refresh_token',
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: refreshToken
  });

  const accessToken = response.data.access_token;
  console.log('Access token retrieved successfully!');
  
  // Now query the Firestore REST API for top 10 users with currentStreak > 0
  console.log('Querying Firestore for users with currentStreak > 0...');
  const queryResponse = await axios.post(
    'https://firestore.googleapis.com/v1/projects/intranet-kihap/databases/(default)/documents:runQuery',
    {
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'currentStreak' },
            op: 'GREATER_THAN',
            value: { integerValue: 0 }
          }
        },
        orderBy: [
          {
            field: { fieldPath: 'currentStreak' },
            direction: 'DESCENDING'
          }
        ],
        limit: 50
      }
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const docs = queryResponse.data || [];
  console.log(`Found ${docs.length} users with currentStreak > 0.`);
  
  docs.forEach((doc, idx) => {
    if (!doc.document) return;
    const name = doc.document.name.split('/').pop();
    const fields = doc.document.fields;
    console.log(`\n[User ${idx + 1}] name: ${fields.name?.stringValue || fields.nome?.stringValue || 'N/A'} (ID: ${name})`);
    console.log(`  currentStreak: ${fields.currentStreak?.integerValue || fields.currentStreak?.doubleValue || 0}`);
    console.log(`  longestStreak: ${fields.longestStreak?.integerValue || fields.longestStreak?.doubleValue || 0}`);
    console.log(`  lastAttendanceDate: ${fields.lastAttendanceDate?.stringValue || 'N/A'}`);
    console.log(`  unidadeId: ${fields.unidadeId?.stringValue || fields.unitId?.stringValue || 'N/A'}`);
  });
}

main().catch(err => {
  console.error('Error:', err.response?.data || err.message);
});
