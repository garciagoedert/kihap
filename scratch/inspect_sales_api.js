const fs = require('fs');

const config = JSON.parse(fs.readFileSync('/Users/goedert/.config/configstore/firebase-tools.json', 'utf8'));
const token = config.tokens.access_token;

async function run() {
  const url = 'https://firestore.googleapis.com/v1/projects/intranet-kihap/databases/(default)/documents:runQuery';
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'inscricoesFaixaPreta' }],
      orderBy: [{ field: { fieldPath: 'created' }, direction: 'DESCENDING' }],
      limit: 10
    }
  };

  console.log('Fetching last 10 entries from Firestore REST API...');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(query)
  });

  const data = await response.json();
  if (data.error || (data[0] && data[0].error)) {
    console.error('API Error:', data.error || data[0].error);
    return;
  }

  console.log('Results found:', data.filter(i => i.document).length);
  data.forEach((item, index) => {
    if (item.document) {
      console.log(`\n--- Document ${index + 1} (${item.document.name.split('/').pop()}) ---`);
      const fields = item.document.fields;
      const formatted = {};
      for (const key in fields) {
        const valObj = fields[key];
        const valType = Object.keys(valObj)[0];
        formatted[key] = valObj[valType];
      }
      console.log(JSON.stringify(formatted, null, 2));
    }
  });
}

run().catch(console.error);
