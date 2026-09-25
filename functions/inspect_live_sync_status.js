const fs = require('fs');
const path = require('path');
const axios = require('axios');

const homeDir = process.env.HOME || '/Users/goedert';
const configPath = path.join(homeDir, '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const accessToken = config.tokens?.access_token;
const PROJECT_ID = "intranet-kihap";

function parseFirestoreDoc(doc) {
    if (!doc || !doc.fields) return {};
    const obj = {};
    for (const [k, v] of Object.entries(doc.fields)) {
        obj[k] = parseValue(v);
    }
    obj.id = doc.name.split('/').pop();
    return obj;
}

function parseValue(val) {
    if (!val) return null;
    if (val.stringValue !== undefined) return val.stringValue;
    if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
    if (val.doubleValue !== undefined) return parseFloat(val.doubleValue);
    if (val.booleanValue !== undefined) return val.booleanValue;
    if (val.nullValue !== undefined) return null;
    if (val.arrayValue) return (val.arrayValue.values || []).map(parseValue);
    if (val.mapValue) {
        const res = {};
        for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
            res[k] = parseValue(v);
        }
        return res;
    }
    return null;
}

async function inspectLiveSyncStatus() {
    console.log("🔍 Inspeccionando todos os documentos de evo_sync_status no Firestore...");
    try {
        const res = await axios.post(
            `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
            { structuredQuery: { from: [{ collectionId: 'evo_sync_status' }] } },
            { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
        );

        const docs = res.data || [];
        console.log(`📊 Total docs em evo_sync_status: ${docs.length}`);
        
        let sumActive = 0;
        docs.forEach(d => {
            if (!d.document) return;
            const parsed = parseFirestoreDoc(d.document);
            const active = parsed.activeStudents || 0;
            sumActive += active;
            console.log(`- Doc "${parsed.id}": activeStudents=${parsed.activeStudents}, totalStudents=${parsed.totalStudents}, status=${parsed.status}`);
        });

        console.log(`\n👉 SOMA DOS activeStudents EM evo_sync_status: ${sumActive}`);

    } catch (e) {
        console.error("Erro:", e.response?.data || e.message);
    }
}

inspectLiveSyncStatus();
