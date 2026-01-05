const functions = require('firebase-functions');
const axios = require('axios');

// Constants
const API_VERSION = 'v22';
const GOOGLE_ADS_ENDPOINT = `https://googleads.googleapis.com/${API_VERSION}`;
const OAUTH_ENDPOINT = 'https://oauth2.googleapis.com/token';

// Helper: Get Access Token from Refresh Token
async function getAccessToken(clientId, clientSecret, refreshToken) {
    try {
        const response = await axios.post(OAUTH_ENDPOINT, null, {
            params: {
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error("Error refreshing token:", error.response?.data || error.message);
        throw new Error("Failed to authenticate with Google: " + (error.response?.data?.error_description || error.message));
    }
}

// Helper: Get Customer ID (REST)
async function getCustomerId(accessToken, developerToken) {
    let customerId = functions.config().google.customer_id;

    if (customerId) return customerId.replace(/-/g, '');

    // List accessible customers
    try {
        const url = `${GOOGLE_ADS_ENDPOINT}/customers:listAccessibleCustomers`;
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': developerToken
            }
        });

        const resourceNames = response.data.resourceNames;
        if (resourceNames && resourceNames.length > 0) {
            // customers/{id}
            customerId = resourceNames[0].split('/')[1];
            console.log(`Using first accessible customer: ${customerId}`);
            return customerId;
        } else {
            throw new Error("No accessible customers found.");
        }
    } catch (error) {
        console.error("Error listing customers:", error.response?.data || error.message);
        throw new Error("Could not determine Customer ID.");
    }
}

// Helper: Run GAQL Query
async function runQuery(customerId, accessToken, developerToken, query) {
    const url = `${GOOGLE_ADS_ENDPOINT}/customers/${customerId}/googleAds:search`;
    const config = functions.config().google;
    const loginCustomerId = config.login_customer_id; // Optional MCC ID

    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json'
    };
    if (loginCustomerId) {
        headers['login-customer-id'] = loginCustomerId;
    }

    try {
        const response = await axios.post(url, {
            query: query
        }, { headers });
        return response.data.results || [];
    } catch (error) {
        // Log detailed error from Axios
        console.error(`[GoogleAds] Error executing query: ${query}`);
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Data:`, JSON.stringify(error.response.data));
        } else {
            console.error(`Message: ${error.message}`);
        }
        throw new Error("Google Ads Query Failed.");
    }
}

/**
 * Cloud Function: getGoogleAdsData
 * Fetches relevant metrics via REST API.
 */
exports.getGoogleAdsData = async (data, context) => {
    // 1. Auth Check
    // if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');

    const { period, dateStart, dateEnd } = data;
    const config = functions.config().google;

    if (!config || !config.client_id || !config.refresh_token) {
        throw new functions.https.HttpsError('failed-precondition', 'Google Credentials not configured.');
    }

    try {
        // 2. Get Access Token
        const accessToken = await getAccessToken(config.client_id, config.client_secret, config.refresh_token);
        const developerToken = config.developer_token;

        // 3. Get Customer ID
        const customerId = await getCustomerId(accessToken, developerToken);

        // 4. Define Date Predicate
        let datePredicate = 'segments.date DURING LAST_30_DAYS'; // Default

        if (period === 'last7') datePredicate = 'segments.date DURING LAST_7_DAYS';
        if (period === 'today') datePredicate = 'segments.date DURING TODAY';
        if (period === 'yesterday') datePredicate = 'segments.date DURING YESTERDAY';
        if (period === 'thisMonth') datePredicate = 'segments.date DURING THIS_MONTH';

        if (period === 'custom' && dateStart && dateEnd) {
            // Ensure format YYYY-MM-DD
            datePredicate = `segments.date BETWEEN '${dateStart}' AND '${dateEnd}'`;
        }

        console.log(`Fetching Google Ads Data for ${customerId} via REST. Predicate: ${datePredicate}`);

        // 5. Build Queries
        // Correct usage: WHERE clause is mandatory for date filtering

        const overviewQuery = `
            SELECT 
                metrics.cost_micros, 
                metrics.impressions, 
                metrics.clicks, 
                metrics.conversions, 
                metrics.ctr,
                metrics.cost_per_conversion,
                metrics.search_impression_share
            FROM customer 
            WHERE ${datePredicate}
        `;

        const dailyQuery = `
            SELECT 
                segments.date,
                metrics.cost_micros, 
                metrics.conversions
            FROM customer 
            WHERE ${datePredicate}
        `;

        const campaignsQuery = `
            SELECT 
                campaign.id, 
                campaign.name, 
                campaign.status,
                campaign.advertising_channel_type,
                metrics.cost_micros, 
                metrics.conversions, 
                metrics.clicks, 
                metrics.ctr,
                metrics.average_cpc, 
                metrics.cost_per_conversion
            FROM campaign 
            WHERE campaign.status != 'REMOVED' AND ${datePredicate}
        `;

        const deviceQuery = `
            SELECT 
                segments.device,
                metrics.impressions
            FROM customer
            WHERE ${datePredicate}
        `;

        // 6. Execute Parallel
        const [overviewRes, dailyRes, campaignsRes, deviceRes] = await Promise.all([
            runQuery(customerId, accessToken, developerToken, overviewQuery),
            runQuery(customerId, accessToken, developerToken, dailyQuery),
            runQuery(customerId, accessToken, developerToken, campaignsQuery),
            runQuery(customerId, accessToken, developerToken, deviceQuery)
        ]);

        // 7. Process Data
        // Overview
        const ovRow = overviewRes[0] || {};
        const overview = {
            spend: (parseInt(ovRow.metrics?.costMicros || '0')) / 1000000,
            impressions: parseInt(ovRow.metrics?.impressions || '0'),
            clicks: parseInt(ovRow.metrics?.clicks || '0'),
            ctr: (parseFloat(ovRow.metrics?.ctr || '0')) * 100,
            conversions: parseFloat(ovRow.metrics?.conversions || '0'),
            cpa: (parseInt(ovRow.metrics?.costPerConversion || '0')) / 1000000,
            impressionShare: ovRow.metrics?.searchImpressionShare || '0%',
            qualityScore: 0
        };

        // Fix Imp Share (comes as string "< 10%" or "12.34%")
        if (overview.impressionShare === '< 10%') overview.impressionShare = 10;
        else overview.impressionShare = parseFloat(overview.impressionShare) || 0;


        // Daily
        const dailyData = dailyRes.map(row => ({
            date: row.segments.date,
            spend: (parseInt(row.metrics.costMicros || '0')) / 1000000,
            conversions: parseFloat(row.metrics.conversions || '0')
        })).sort((a, b) => new Date(a.date) - new Date(b.date));

        const labels = dailyData.map(d => {
            const date = new Date(d.date + 'T12:00:00');
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        });
        const dailySpend = dailyData.map(d => d.spend);
        const dailyConversions = dailyData.map(d => d.conversions);

        // Campaigns
        const campaigns = campaignsRes.map(row => ({
            id: row.campaign.id,
            name: row.campaign.name,
            status: row.campaign.status?.toLowerCase() === 'enabled' ? 'active' : 'paused',
            type: formatChannelType(row.campaign.advertisingChannelType),
            spend: (parseInt(row.metrics.costMicros || '0')) / 1000000,
            conversions: parseFloat(row.metrics.conversions || '0'),
            clicks: parseInt(row.metrics.clicks || '0'),
            ctr: (parseFloat(row.metrics.ctr || '0')) * 100,
            cpc: (parseInt(row.metrics.averageCpc || '0')) / 1000000,
            cpa: (parseInt(row.metrics.costPerConversion || '0')) / 1000000
        }));

        // Device
        let deviceMapping = { 'MOBILE': 0, 'DESKTOP': 0, 'TABLET': 0 };
        deviceRes.forEach(row => {
            const dev = row.segments.device; // UNSPECIFIED, UNKNOWN, DESKTOP, MOBILE, TABLET, CONNECTED_TV
            const imps = parseInt(row.metrics.impressions || '0');
            if (deviceMapping.hasOwnProperty(dev)) {
                deviceMapping[dev] += imps;
            } else {
                if (!deviceMapping.Other) deviceMapping.Other = 0;
                deviceMapping.Other += imps;
            }
        });
        const deviceSplit = [deviceMapping['MOBILE'], deviceMapping['DESKTOP'], deviceMapping['TABLET']];

        return {
            overview,
            charts: {
                labels,
                dailySpend,
                dailyConversions,
                deviceSplit
            },
            campaigns
        };

    } catch (error) {
        console.error("REST API Error:", error);
        throw new functions.https.HttpsError('internal', `Google Ads API Error: ${error.message}`);
    }
};

function formatChannelType(type) {
    if (!type) return 'Unknown';
    if (type === 'SEARCH') return 'Search';
    if (type === 'DISPLAY') return 'Display';
    if (type === 'VIDEO') return 'Youtube';
    if (type === 'MULTI_CHANNEL') return 'PMax';
    return type;
}
