// Native fetch used


// Hardcoded for test script (from social-config.js)
const accessToken = "EAAMFtRyjG1QBQeqZAZAZBxZCYYJmFukkqSqfMbuiNgRbKgN8m8273HGTN4gYRemicvV2RSqbDmEDA7KtdtZB0eKjFU1UtLlok8Te4TnquYtHdfTwaUdtYzISmh6xSM3O75e5Q8kP3Qosb6f2wZAn5fvzWplNwAi2P5vPSnln5eVC5ZAzUrL7ovW5uPaFi7cJuHUPW1oymee9y4kAHijhp80";
const adAccountId = "1252465245122204";
const apiVersion = "v19.0";

async function testMeta() {
    console.log("Testing Meta API...");
    const baseUrl = `https://graph.facebook.com/${apiVersion}/act_${adAccountId}`;

    // 1. Fetch Insights
    const insightsUrl = `${baseUrl}/insights?level=account&date_preset=last_30d&fields=spend,impressions,clicks,actions,reach&access_token=${accessToken}`;
    console.log(`Fetching Insights: ${insightsUrl.replace(accessToken, '***')}`);

    try {
        const res = await fetch(insightsUrl);
        const json = await res.json();
        console.log("--- INSIGHTS RESPONSE ---");
        console.log(JSON.stringify(json, null, 2));
    } catch (e) {
        console.error("Error fetching insights:", e);
    }

    // 2. Fetch Campaigns
    const campaignsUrl = `${baseUrl}/campaigns?fields=name,status,insights.date_preset(last_30d){spend,results,reach,actions}&effective_status=['ACTIVE','PAUSED']&limit=5&access_token=${accessToken}`;
    console.log(`Fetching Campaigns: ${campaignsUrl.replace(accessToken, '***')}`);

    try {
        const res = await fetch(campaignsUrl);
        const json = await res.json();
        console.log("--- CAMPAIGNS RESPONSE ---");
        console.log(JSON.stringify(json, null, 2));
    } catch (e) {
        console.error("Error fetching campaigns:", e);
    }
}

// Node 18+ has fetch built-in, handling polyfill check
if (!globalThis.fetch) {
    console.log("No native fetch, skipping exec or need install node-fetch");
} else {
    testMeta();
}
