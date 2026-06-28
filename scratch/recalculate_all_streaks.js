const fs = require('fs');
const path = require('path');
const axios = require('axios');

const homeDir = process.env.HOME || '/Users/goedert';
const configPath = path.join(homeDir, '.config', 'configstore', 'firebase-tools.json');

if (!fs.existsSync(configPath)) {
  console.error('Firebase CLI config file not found at:', configPath);
  process.exit(1);
}

function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function main() {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const tokens = config.tokens || {};
  const refreshToken = tokens.refresh_token;

  if (!refreshToken) {
    console.error('No refresh token found in Firebase CLI config.');
    process.exit(1);
  }

  console.log('Retrieving OAuth Access Token from Google...');
  const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
    grant_type: 'refresh_token',
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: refreshToken
  });

  const accessToken = tokenRes.data.access_token;
  console.log('Access token retrieved successfully.');

  console.log("Recuperando todos os usuários da coleção 'users'...");
  const usersResponse = await axios.post(
    'https://firestore.googleapis.com/v1/projects/intranet-kihap/databases/(default)/documents:runQuery',
    {
      structuredQuery: {
        from: [{ collectionId: 'users' }]
      }
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const docs = usersResponse.data || [];
  console.log(`Encontrados ${docs.length} documentos.`);

  const todayStr = getLocalDateString(new Date());

  for (const docObj of docs) {
    if (!docObj.document) continue;
    const docName = docObj.document.name;
    const docId = docName.split('/').pop();
    const fields = docObj.document.fields || {};

    const name = fields.name?.stringValue || fields.nome?.stringValue || 'Sem Nome';
    const evoMemberIdVal = fields.evoMemberId?.integerValue || fields.evoMemberId?.stringValue || fields.evoMemberId?.doubleValue;

    if (!evoMemberIdVal) {
      console.log(`- Usuário ${name} (ID: ${docId}) não possui evoMemberId. Pulando.`);
      continue;
    }

    const studentId = Number(evoMemberIdVal);
    console.log(`- Recalculando streak para: ${name} (ID: ${docId}, EVO ID: ${studentId})`);

    try {
      // Query instances containing the student as number
      const numQueryRes = await axios.post(
        'https://firestore.googleapis.com/v1/projects/intranet-kihap/databases/(default)/documents:runQuery',
        {
          structuredQuery: {
            from: [{ collectionId: 'classInstances' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'presentStudents' },
                op: 'ARRAY_CONTAINS',
                value: { integerValue: studentId }
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

      // Query instances containing the student as string
      const strQueryRes = await axios.post(
        'https://firestore.googleapis.com/v1/projects/intranet-kihap/databases/(default)/documents:runQuery',
        {
          structuredQuery: {
            from: [{ collectionId: 'classInstances' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'presentStudents' },
                op: 'ARRAY_CONTAINS',
                value: { stringValue: studentId.toString() }
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

      const uniqueDates = new Set();
      const docsNum = numQueryRes.data || [];
      const docsStr = strQueryRes.data || [];

      docsNum.forEach(d => {
        if (!d.document) return;
        const dateVal = d.document.fields?.date?.stringValue;
        if (dateVal) uniqueDates.add(dateVal);
      });

      docsStr.forEach(d => {
        if (!d.document) return;
        const dateVal = d.document.fields?.date?.stringValue;
        if (dateVal) uniqueDates.add(dateVal);
      });

      const sortedDates = Array.from(uniqueDates).sort();

      let currentStreak = 0;
      let longestStreak = 0;
      let lastAttendanceDate = null;

      if (sortedDates.length > 0) {
        let current = 0;
        let longest = 0;
        let prevDateStr = null;

        for (const dateStr of sortedDates) {
          if (!prevDateStr) {
            current = 1;
          } else {
            const prev = new Date(prevDateStr + 'T12:00:00');
            const curr = new Date(dateStr + 'T12:00:00');
            const diffTime = Math.abs(curr.getTime() - prev.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= 5) {
              current += 1;
            } else {
              current = 1;
            }
          }

          if (current > longest) {
            longest = current;
          }

          prevDateStr = dateStr;
        }

        const lastDateStr = sortedDates[sortedDates.length - 1];
        const lastDate = new Date(lastDateStr + 'T12:00:00');
        const todayDate = new Date(todayStr + 'T12:00:00');
        const diffTimeToday = todayDate.getTime() - lastDate.getTime();
        const diffDaysToday = Math.floor(diffTimeToday / (1000 * 60 * 60 * 24));

        currentStreak = current;
        if (diffDaysToday > 5) {
          currentStreak = 0;
        }
        longestStreak = longest;
        lastAttendanceDate = lastDateStr;
      }

      console.log(`  -> Novo Streak: Atual=${currentStreak}, Máximo=${longestStreak}, Última Presença=${lastAttendanceDate}`);

      // Perform patch update via REST API
      const patchFields = {
        currentStreak: { integerValue: currentStreak },
        longestStreak: { integerValue: longestStreak }
      };
      if (lastAttendanceDate) {
        patchFields.lastAttendanceDate = { stringValue: lastAttendanceDate };
      } else {
        patchFields.lastAttendanceDate = { nullValue: null };
      }

      await axios.patch(
        `https://firestore.googleapis.com/v1/${docName}?updateMask.fieldPaths=currentStreak&updateMask.fieldPaths=longestStreak&updateMask.fieldPaths=lastAttendanceDate`,
        {
          fields: patchFields
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

    } catch (err) {
      console.error(`Erro ao processar usuário ${name}:`, err.response?.data || err.message);
    }
  }

  console.log("Processamento concluído com sucesso!");
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
