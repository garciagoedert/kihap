import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

async function checkTasks() {
    const results = [];
    const appIds = ['1:1055939458006:web:1d67459a0bc0da60cf2a77', 'default-app', 'default-kihap-app', 'intranet-kihap'];
    for (const id of appIds) {
        const path = `artifacts/${id}/public/data/tasks`;
        try {
            const snapshot = await getDocs(collection(db, ...path.split('/')));
            results.push({ id, count: snapshot.size });
        } catch (e) {
            results.push({ id, error: e.message });
        }
    }
    // We can't write to file from browser, but I can use this in a node script if I had service account.
    // Since I don't, I will just assume 'default-app' or the full ID is correct.
}
