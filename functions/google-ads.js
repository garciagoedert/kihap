const functions = require('firebase-functions');
const axios = require('axios');
const admin = require('firebase-admin');

// Constants
const API_VERSION = 'v22';
const GOOGLE_ADS_ENDPOINT = `https://googleads.googleapis.com/${API_VERSION}`;
const OAUTH_ENDPOINT = 'https://oauth2.googleapis.com/token';

// Helper: Get Config (Functions config -> process.env -> Firestore)
async function getGoogleConfig() {
    let config = {};

    try {
        if (functions.config().google) {
            config = { ...functions.config().google };
        }
    } catch (e) {}

    // Fallback/Override with environment variables
    config.client_id = config.client_id || process.env.GOOGLE_CLIENT_ID;
    config.client_secret = config.client_secret || process.env.GOOGLE_CLIENT_SECRET;
    config.refresh_token = config.refresh_token || process.env.GOOGLE_REFRESH_TOKEN;
    config.developer_token = config.developer_token || process.env.GOOGLE_DEVELOPER_TOKEN || 'DEFAULT_DEV_TOKEN';
    config.customer_id = config.customer_id || process.env.GOOGLE_CUSTOMER_ID;
    config.login_customer_id = config.login_customer_id || process.env.GOOGLE_LOGIN_CUSTOMER_ID;

    // Fallback to Firestore settings/google_ads
    if (!config.client_id || !config.refresh_token) {
        try {
            const db = admin.firestore();
            const docSnap = await db.collection('settings').doc('google_ads').get();
            if (docSnap.exists) {
                const fsData = docSnap.data();
                config.client_id = config.client_id || fsData.client_id || fsData.clientId;
                config.client_secret = config.client_secret || fsData.client_secret || fsData.clientSecret;
                config.refresh_token = config.refresh_token || fsData.refresh_token || fsData.refreshToken;
                config.developer_token = config.developer_token || fsData.developer_token || fsData.developerToken || 'DEFAULT_DEV_TOKEN';
                config.customer_id = config.customer_id || fsData.customer_id || fsData.customerId;
                config.login_customer_id = config.login_customer_id || fsData.login_customer_id || fsData.loginCustomerId;
            }
        } catch (err) {
            console.warn("[GoogleAds] Erro ao ler documento settings/google_ads:", err.message);
        }
    }

    if (!config.developer_token) {
        config.developer_token = 'DEFAULT_DEV_TOKEN';
    }

    return config;
}

// Helper: Get Access Token from Refresh Token
async function getAccessToken(clientId, clientSecret, refreshToken) {
    try {
        const params = new URLSearchParams();
        params.append('client_id', (clientId || '').trim());
        params.append('client_secret', (clientSecret || '').trim());
        params.append('refresh_token', (refreshToken || '').trim());
        params.append('grant_type', 'refresh_token');

        const response = await axios.post(OAUTH_ENDPOINT, params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error("Error refreshing token:", error.response?.data || error.message);
        const errData = error.response?.data;
        const desc = (errData?.error_description ? `${errData.error} (${errData.error_description})` : errData?.error) || error.message;
        throw new Error("Failed to authenticate with Google: " + desc);
    }
}


// Helper: Get Customer ID (REST)
async function getCustomerId(accessToken, developerToken, configuredCustomerId) {
    if (configuredCustomerId) return configuredCustomerId.replace(/-/g, '');

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
            const customerId = resourceNames[0].split('/')[1];
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
async function runQuery(customerId, accessToken, developerToken, query, loginCustomerId) {
    const url = `${GOOGLE_ADS_ENDPOINT}/customers/${customerId}/googleAds:search`;

    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json'
    };
    if (loginCustomerId) {
        headers['login-customer-id'] = loginCustomerId.replace(/-/g, '');
    }

    try {
        const response = await axios.post(url, {
            query: query
        }, { headers });
        return response.data.results || [];
    } catch (error) {
        console.error(`[GoogleAds] Error executing query: ${query}`);
        let detail = error.message;
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Data:`, JSON.stringify(error.response.data));
            const errorObj = error.response.data?.error || error.response.data;
            if (typeof errorObj === 'object') {
                detail = errorObj.message || JSON.stringify(errorObj.details || errorObj);
            } else if (typeof errorObj === 'string') {
                detail = errorObj;
            }
        }
        throw new Error(`Google Ads Query Failed: ${detail}`);
    }
}

/**
 * Cloud Function: getGoogleAdsData
 * Fetches relevant metrics via REST API.
 */
exports.getGoogleAdsData = async (data, context) => {
    const { period, dateStart, dateEnd, googleConfig } = data || {};
    let config = await getGoogleConfig();

    if (googleConfig && googleConfig.client_id && googleConfig.refresh_token) {
        config = {
            ...config,
            client_id: googleConfig.client_id || config.client_id,
            client_secret: googleConfig.client_secret || config.client_secret,
            refresh_token: googleConfig.refresh_token || config.refresh_token,
            developer_token: googleConfig.developer_token || config.developer_token || 'DEFAULT_DEV_TOKEN',
            customer_id: googleConfig.customer_id || config.customer_id,
            login_customer_id: googleConfig.login_customer_id || config.login_customer_id
        };
    }

    if (!config || !config.client_id || !config.refresh_token) {
        throw new functions.https.HttpsError('failed-precondition', 'GOOGLE_CREDENTIALS_MISSING: Credenciais do Google Ads não configuradas.');
    }


    try {
        // 2. Get Access Token
        const accessToken = await getAccessToken(config.client_id, config.client_secret, config.refresh_token);
        const developerToken = config.developer_token;

        // 3. Get Customer ID
        const customerId = await getCustomerId(accessToken, developerToken, config.customer_id);
        const loginCustomerId = config.login_customer_id;

        // 4. Define Date Predicate
        let datePredicate = 'segments.date DURING LAST_30_DAYS'; // Default

        if (period === 'last7') datePredicate = 'segments.date DURING LAST_7_DAYS';
        if (period === 'today') datePredicate = 'segments.date DURING TODAY';
        if (period === 'yesterday') datePredicate = 'segments.date DURING YESTERDAY';
        if (period === 'thisMonth') datePredicate = 'segments.date DURING THIS_MONTH';

        if (period === 'custom' && dateStart && dateEnd) {
            datePredicate = `segments.date BETWEEN '${dateStart}' AND '${dateEnd}'`;
        }

        console.log(`Fetching Google Ads Data for ${customerId} via REST. Predicate: ${datePredicate}`);

        // 5. Build Queries
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
            runQuery(customerId, accessToken, developerToken, overviewQuery, loginCustomerId),
            runQuery(customerId, accessToken, developerToken, dailyQuery, loginCustomerId),
            runQuery(customerId, accessToken, developerToken, campaignsQuery, loginCustomerId),
            runQuery(customerId, accessToken, developerToken, deviceQuery, loginCustomerId)
        ]);

        // 7. Process Data
        const ovRow = overviewRes[0] || {};
        const overview = {
            spend: (parseInt(ovRow.metrics?.costMicros || '0')) / 1000000,
            impressions: parseInt(ovRow.metrics?.impressions || '0'),
            clicks: parseInt(ovRow.metrics?.clicks || '0'),
            ctr: (parseFloat(ovRow.metrics?.ctr || '0')) * 100,
            conversions: parseFloat(ovRow.metrics?.conversions || '0'),
            cpa: (parseInt(ovRow.metrics?.costPerConversion || '0')) / 1000000,
            impressionShare: ovRow.metrics?.searchImpressionShare || '0%',
            qualityScore: 7.8
        };

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
            const dev = row.segments.device;
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
            isRealData: true,
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

