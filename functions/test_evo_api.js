const axios = require('axios');
const https = require('https');

// Credenciais do EVO de acordo com evo.js
const EVO_CREDENTIALS = {
    centro: { dns: "atadf", token: "08AD03F4-B0A7-4B4B-958C-38C81EA66E48" },
    "asa-sul": { dns: "atadf", token: "79D29584-14EB-4E13-8C06-E55A4BC7FD8E" },
    sudoeste: { dns: "atadf", token: "F33EBA37-367A-42A8-B598-3DDF0387F997" },
    "lago-sul": { dns: "atadf", token: "3FABB904-BE55-474F-99CE-C1901962679B" },
    "coqueiros": { dns: "atadf", token: "9409BA4A-CA49-45ED-86D5-35BF336ECFAF" } // Essa disse que funcionou
};

const httpsAgent = new https.Agent({ family: 4 });

async function testUnit(unitId, params) {
    const creds = EVO_CREDENTIALS[unitId];
    console.log(`\n--- Testando ${unitId} ---`);
    console.log(`Params: ${JSON.stringify(params)}`);

    try {
        const response = await axios.get(`https://evo-integracao-api.w12app.com.br/api/v2/members`, {
            params: params,
            headers: {
                "Authorization": `Basic ${Buffer.from(`${creds.dns}:${creds.token}`).toString("base64")}`,
                "Content-Type": "application/json"
            },
            httpsAgent: httpsAgent,
            timeout: 30000
        });
        console.log(`✅ Sucesso! Recebidos ${response.data.length} membros.`);
        if (response.data.length > 0) {
            const m = response.data[0];
            console.log(`Exemplo de membro: ${m.firstName} | totalFitCoins: ${m.totalFitCoins} | memberships: ${m.memberships ? m.memberships.length : 'N/A'}`);
        }
    } catch (error) {
        console.log(`❌ Erro ${error.response ? error.response.status : error.message}`);
        if (error.response && error.response.data) {
            console.log(`Data: ${JSON.stringify(error.response.data)}`);
        }
    }
}

async function runTests() {
    // 1. Testa a unidade que sabemos que funciona (coqueiros) com params normais
    await testUnit('coqueiros', { page: 1, take: 50, status: 1, showMemberships: true });

    // 2. Testa uma unidade que falha (sudoeste) com params normais
    await testUnit('sudoeste', { page: 1, take: 50, status: 1, showMemberships: true });

    // 3. Testa sudoeste SEM showMemberships
    await testUnit('sudoeste', { page: 1, take: 50, status: 1, showMemberships: false });

    // 4. Testa sudoeste com take: 1 (mínimo)
    await testUnit('sudoeste', { page: 1, take: 1, status: 1, showMemberships: false });
}

runTests();
