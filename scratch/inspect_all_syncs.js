const fs = require('fs');
const path = require('path');

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

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
      refresh_token: refreshToken
    })
  });

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;
  const projectId = 'intranet-kihap';

  console.log('--- INSPECTING SYNC STATUS (evo_sync_status) ---');
  const syncStatusResponse = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/evo_sync_status`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  const syncStatusData = await syncStatusResponse.json();
  const docs = syncStatusData.documents || [];
  for (const doc of docs) {
    const unitName = doc.name.split('/').pop();
    const fields = doc.fields;
    console.log(`Unit: ${unitName}`);
    console.log(`  status: ${fields.status?.stringValue || 'N/A'}`);
    console.log(`  lastSync: ${fields.lastSync?.timestampValue || 'N/A'}`);
    console.log(`  totalStudents: ${fields.totalStudents?.integerValue || 'N/A'}`);
    console.log('---');
  }

  console.log('\n--- CALLING listAllMembers Cloud Function (unitId: all) ---');
  try {
    const callableResponse = await fetch(
      `https://us-central1-${projectId}.cloudfunctions.net/listAllMembers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data: { unitId: 'all' } })
      }
    );
    console.log(`Callable status: ${callableResponse.status}`);
    const resData = await callableResponse.json();
    const returnedCount = resData.result?.length || resData.length || 0;
    console.log(`Returned count of members: ${returnedCount}`);
    if (returnedCount > 0) {
      console.log('First 3 members returned:');
      const members = resData.result || resData || [];
      console.log(members.slice(0, 3).map(m => `${m.firstName} ${m.lastName} (${m.unitId})` + ` [ID: ${m.idMember}]`));
    } else {
      console.log('Full response structure:', JSON.stringify(resData));
    }
  } catch (err) {
    console.error('Callable call failed:', err.message);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
});
