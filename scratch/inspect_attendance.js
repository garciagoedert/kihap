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
  
  // We want to query the classInstances collection
  console.log('Querying all classInstances in Firestore...');
  const queryResponse = await axios.post(
    'https://firestore.googleapis.com/v1/projects/intranet-kihap/databases/(default)/documents:runQuery',
    {
      structuredQuery: {
        from: [{ collectionId: 'classInstances' }],
        limit: 100
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
  console.log(`Found ${docs.length} class instances.`);
  
  // Map of studentId -> Set of dates attended
  const attendanceMap = {};
  
  docs.forEach((doc, idx) => {
    if (!doc.document) return;
    const fields = doc.document.fields;
    const date = fields.date?.stringValue;
    const presentStudents = fields.presentStudents?.arrayValue?.values || [];
    
    presentStudents.forEach(valObj => {
      const studentId = valObj.stringValue || valObj.integerValue;
      if (studentId) {
        if (!attendanceMap[studentId]) {
          attendanceMap[studentId] = new Set();
        }
        attendanceMap[studentId].add(date);
      }
    });
  });

  console.log('\nAttendance count per student:');
  for (const [studentId, dates] of Object.entries(attendanceMap)) {
    const datesArr = Array.from(dates).sort();
    console.log(`Student ID: ${studentId}`);
    console.log(`  Total unique dates attended: ${datesArr.length}`);
    console.log(`  Dates: ${datesArr.join(', ')}`);
  }
}

main().catch(err => {
  console.error('Error:', err.response?.data || err.message);
});
