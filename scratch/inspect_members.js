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

  const response = await axios.post('https://oauth2.googleapis.com/token', {
    grant_type: 'refresh_token',
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: refreshToken
  });

  const accessToken = response.data.access_token;
  
  const targetIds = ['3603', '3875', '4705'];
  console.log(`Checking user records for evoMemberId in ${targetIds.join(', ')}...`);

  for (const evoId of targetIds) {
    const queryResponse = await axios.post(
      'https://firestore.googleapis.com/v1/projects/intranet-kihap/databases/(default)/documents:runQuery',
      {
        structuredQuery: {
          from: [{ collectionId: 'users' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'evoMemberId' },
              op: 'EQUAL',
              value: { integerValue: Number(evoId) }
            }
          }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let docs = queryResponse.data || [];
    if (docs.length === 0 || !docs[0].document) {
      // Try string search
      const queryResponseStr = await axios.post(
        'https://firestore.googleapis.com/v1/projects/intranet-kihap/databases/(default)/documents:runQuery',
        {
          structuredQuery: {
            from: [{ collectionId: 'users' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'evoMemberId' },
                op: 'EQUAL',
                value: { stringValue: evoId }
              }
            }
          }
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      docs = queryResponseStr.data || [];
    }

    if (docs.length > 0 && docs[0].document) {
      const doc = docs[0].document;
      const name = doc.name.split('/').pop();
      const fields = doc.fields;
      console.log(`\n[Member ID: ${evoId}] (User ID: ${name})`);
      console.log(`  Name: ${fields.name?.stringValue || fields.nome?.stringValue || 'N/A'}`);
      console.log(`  currentStreak: ${fields.currentStreak?.integerValue || fields.currentStreak?.doubleValue || 0}`);
      console.log(`  longestStreak: ${fields.longestStreak?.integerValue || fields.longestStreak?.doubleValue || 0}`);
      console.log(`  lastAttendanceDate: ${fields.lastAttendanceDate?.stringValue || 'N/A'}`);
    } else {
      console.log(`\nNo user found with evoMemberId: ${evoId}`);
    }
  }
}

main().catch(err => {
  console.error('Error:', err.response?.data || err.message);
});
