// Script para sincronizar dados do EVO para o cache no Firestore
const admin = require('firebase-admin');
const functions = require('firebase-functions');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Importa as credenciais do EVO
const EVO_CREDENTIALS = {
    "centro": { dns: "kihapcentro", token: "42fb69cd-4af3-492c-8b68-76a60e0ef0eb" },
    "coqueiros": { dns: "kihap", token: "80e16fbb-d2b4-4a52-ac1d-efed45ba1541" },
    "asa-sul": { dns: "kihapasasul", token: "0b825f89-1bda-42a3-af86-e6deb03c1ac3" },
    "sudoeste": { dns: "kihapsudoeste", token: "5a50b5e5-e67e-4a00-b730-e858ed3b6a84" },
    "lago-sul": { dns: "kihaplagosul", token: "f61937e2-da78-4e91-a095-f7a086db2e1b" },
    "pontos-de-ensino": { dns: "kihappontosdeensino", token: "a7cdc4ba-99a1-4a55-a37d-31c8bd3a13fc" },
    "jardim-botanico": { dns: "kihapjardimbotanico", token: "5a7bed46-85f8-4b7b-a56d-a42bb5c561c0" },
    "dourados": { dns: "kihapdourados", token: "dc8f7aa3-3d86-40c5-9a57-35c2e7c88e8d" },
    "santa-monica": { dns: "kihapsantamonica", token: "3e8a34bc-cb3e-4bfb-a34e-0764da86bc04" },
    "noroeste": { dns: "kihapnoroeste", token: "78ee3fbc-e72b-44c2-8959-d1e6e4ef8e60" },
    "store": { dns: "atadf", token: "d3a5e33f-db6d-400e-863d-57e7e2a69e70" }
};

const axios = require('axios');
const https = require('https');

function getEvoApiClient(unitId) {
    const credentials = EVO_CREDENTIALS[unitId];
    if (!credentials) {
        throw new Error(`Credenciais para a unidade '${unitId}' não encontradas.`);
    }

    const httpsAgent = new https.Agent({ family: 4 });

    return axios.create({
        baseURL: 'https://evo-integracao-api.w12app.com.br/api/v2',
        headers: {
            "Authorization": `Basic ${Buffer.from(`${credentials.dns}:${credentials.token}`).toString("base64")}`,
            "Content-Type": "application/json"
        },
        httpsAgent: httpsAgent,
        timeout: 60000
    });
}

async function syncUnit(unitId) {
    console.log(`\n🔄 Sincronizando unidade: ${unitId}`);

    try {
        const apiClient = getEvoApiClient(unitId);
        let allMembers = [];
        const PAGE_SIZE = 500;

        // Função para buscar todas as páginas de um status
        const fetchAllPages = async (status) => {
            let currentPage = 1;
            let hasMorePages = true;
            let members = [];

            while (hasMorePages) {
                try {
                    const response = await apiClient.get('/members', {
                        params: {
                            page: currentPage,
                            take: PAGE_SIZE,
                            showMemberships: true,
                            status: status
                        }
                    });

                    const pageMembers = response.data || [];
                    if (pageMembers.length > 0) {
                        members = members.concat(pageMembers);
                        console.log(`  ✓ Página ${currentPage} (status ${status}): ${pageMembers.length} alunos`);
                    }

                    if (pageMembers.length < PAGE_SIZE) {
                        hasMorePages = false;
                    }
                    currentPage++;
                } catch (err) {
                    console.error(`  ✗ Erro na página ${currentPage} (status ${status}): ${err.message}`);
                    hasMorePages = false;
                }
            }

            return members;
        };

        // Busca ativos e inativos
        const [activeMembers, inactiveMembers] = await Promise.all([
            fetchAllPages(1),
            fetchAllPages(2)
        ]);

        allMembers = (activeMembers || []).concat(inactiveMembers || []);

        // Normaliza dados
        allMembers.forEach(member => {
            member.branchName = member.branchName || unitId;
            member.unitId = unitId;
            let totalCoins = 0;
            if (member.hasOwnProperty('totalFitCoins')) {
                totalCoins = member.totalFitCoins;
            } else if (member.hasOwnProperty('fitCoins')) {
                totalCoins = member.fitCoins;
            } else if (Array.isArray(member.memberships) && member.memberships.length > 0) {
                totalCoins = member.memberships.reduce((sum, m) => sum + (m.fitCoins || 0), 0);
            }
            member.totalFitCoins = totalCoins;
        });

        // Salva no Firestore
        await db.collection('evo_students_cache').doc(unitId).set({
            lastSync: admin.firestore.FieldValue.serverTimestamp(),
            totalStudents: allMembers.length,
            students: allMembers
        });

        console.log(`✅ ${unitId}: ${allMembers.length} alunos salvos no cache`);
        return { unitId, success: true, count: allMembers.length };

    } catch (error) {
        console.error(`❌ ${unitId}: ${error.message}`);
        return { unitId, success: false, error: error.message };
    }
}

async function syncAll() {
    console.log('🚀 Iniciando sincronização de todas as unidades...\n');

    const unitIds = Object.keys(EVO_CREDENTIALS);
    const results = [];

    for (const unitId of unitIds) {
        const result = await syncUnit(unitId);
        results.push(result);
    }

    console.log('\n📊 RESUMO DA SINCRONIZAÇÃO:');
    console.log('═══════════════════════════════════════');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const totalStudents = successful.reduce((sum, r) => sum + (r.count || 0), 0);

    console.log(`✅ Sucesso: ${successful.length} unidades`);
    console.log(`❌ Falhas: ${failed.length} unidades`);
    console.log(`📊 Total de alunos: ${totalStudents}`);

    if (successful.length > 0) {
        console.log('\n✅ Unidades sincronizadas:');
        successful.forEach(r => {
            console.log(`   - ${r.unitId}: ${r.count} alunos`);
        });
    }

    if (failed.length > 0) {
        console.log('\n❌ Unidades com erro:');
        failed.forEach(r => {
            console.log(`   - ${r.unitId}: ${r.error}`);
        });
    }

    console.log('\n✨ Sincronização concluída!');
    process.exit(0);
}

// Executa
syncAll().catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
});
