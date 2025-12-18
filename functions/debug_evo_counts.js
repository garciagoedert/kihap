const axios = require("axios");
const https = require("https");

const EVO_CREDENTIALS = {
    centro: { dns: "atadf", token: "08AD03F4-B0A7-4B4B-958C-38C81EA66E48" },
    coqueiros: { dns: "atadf", token: "9409BA4A-CA49-45ED-86D5-35BF336ECFAF" },
    "asa-sul": { dns: "atadf", token: "79D29584-14EB-4E13-8C06-E55A4BC7FD8E" },
    sudoeste: { dns: "atadf", token: "F33EBA37-367A-42A8-B598-3DDF0387F997" },
    "lago-sul": { dns: "atadf", token: "3FABB904-BE55-474F-99CE-C1901962679B" },
    "pontos-de-ensino": { dns: "atadf", token: "0543427D-8C44-4150-B5AB-F15761F63B8B" },
    "jardim-botanico": { dns: "atadf", token: "9F34BB72-1368-4E97-B933-323BE40C54CC" },
    dourados: { dns: "atadf", token: "7A515FA0-3C34-465C-B5B7-9D60DECB9882" },
    "santa-monica": { dns: "atadf", token: "78C3EA0E-3757-4FE0-A40C-E0C9E3E4D79B" },
    noroeste: { dns: "atadf", token: "EB5D8DDB-7263-476D-9491-2DD3F4BB7414" },
    store: { dns: "atadf", token: "F5389AF2-DEA8-49E4-850F-7365A5077CC6" }
};

function getEvoApiClient(unitId) {
    const credentials = EVO_CREDENTIALS[unitId];
    // Force IPv4
    const httpsAgent = new https.Agent({ family: 4 });
    return axios.create({
        baseURL: `https://evo-integracao-api.w12app.com.br/api/v2`,
        headers: {
            "Authorization": `Basic ${Buffer.from(`${credentials.dns}:${credentials.token}`).toString("base64")}`,
            "Content-Type": "application/json"
        },
        httpsAgent: httpsAgent,
        timeout: 10000 // 10s timeout
    });
}

async function debugCounts() {
    console.log("Checking accounts for each unit...");

    for (const [unitId, creds] of Object.entries(EVO_CREDENTIALS)) {
        try {
            const client = getEvoApiClient(unitId);
            // Just fetch 1 item to get the 'total' header or length
            // We'll check active (1) and inactive (0/2 needs verification but 1 is active)
            const response = await client.get("/members", {
                params: { take: 1, status: 1, showMemberships: false }
            });

            // EVO API usually returns total in headers 'total' or 'x-total-count' or we can rely on data
            // But let's check logs
            const total = response.headers['total'] || 'N/A';
            const dataLength = response.data ? response.data.length : 0;

            console.log(`[SUCCESS] ${unitId}: Total Header=${total}, Data Length=${dataLength}`);

        } catch (error) {
            const status = error.response ? error.response.status : 'No Response';
            const msg = error.message;
            console.log(`[FAIL] ${unitId}: Status=${status}, Error=${msg}`);
        }
    }
}

debugCounts();
