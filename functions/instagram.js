const functions = require('firebase-functions/v1');
const axios = require('axios');

/**
 * Busca stories ativos de uma conta do Instagram Business.
 * Esta função age como um proxy seguro para não expor o Access Token no cliente.
 */
exports.getInstagramStories = async (data, context) => {
    // 1. Verificação de Autenticação (Opcional, mas recomendado para evitar abusos)
    // if (!context.auth) {
    //     throw new functions.https.HttpsError('unauthenticated', 'O usuário deve estar autenticado.');
    // }

    // NOTA: Em produção, estas chaves devem vir de functions.config() ou Cloud Secrets.
    // Para agilidade inicial, usaremos o token fornecido no projeto.
    const FACEBOOK_ACCESS_TOKEN = "EAAMFtRyjG1QBQeqZAZAZBxZCYYJmFukkqSqfMbuiNgRbKgN8m8273HGTN4gYRemicvV2RSqbDmEDA7KtdtZB0eKjFU1UtLlok8Te4TnquYtHdfTwaUdtYzISmh6xSM3O75e5Q8kP3Qosb6f2wZAn5fvzWplNwAi2P5vPSnln5eVC5ZAzUrL7ovW5uPaFi7cJuHUPW1oymee9y4kAHijhp80";
    const API_VERSION = "v19.0";

    try {
        // Passo 1: Obter o ID da conta do Instagram Business vinculada ao token
        const pagesUrl = `https://graph.facebook.com/${API_VERSION}/me/accounts?fields=instagram_business_account{id,username,profile_picture_url}&access_token=${FACEBOOK_ACCESS_TOKEN}`;
        const pagesRes = await axios.get(pagesUrl);
        const igAccount = pagesRes.data.data?.[0]?.instagram_business_account;

        if (!igAccount) {
            return { success: false, error: "Nenhuma conta do Instagram Business encontrada vinculada a este token." };
        }

        const igUserId = igAccount.id;

        // Passo 2: Buscar os Stories ativos
        const storiesUrl = `https://graph.facebook.com/${API_VERSION}/${igUserId}/stories?fields=media_url,media_type,permalink,thumbnail_url,timestamp&access_token=${FACEBOOK_ACCESS_TOKEN}`;
        const storiesRes = await axios.get(storiesUrl);
        
        if (storiesRes.data.error) {
            throw new functions.https.HttpsError('internal', 'Erro na API do Instagram: ' + storiesRes.data.error.message);
        }

        // Formatar resposta para o frontend
        const stories = (storiesRes.data.data || []).map(s => ({
            id: s.id,
            url: s.media_url,
            type: s.media_type,
            permalink: s.permalink,
            thumbnail: s.thumbnail_url || s.media_url,
            timestamp: s.timestamp
        }));

        return {
            account: {
                username: igAccount.username,
                profile_picture: igAccount.profile_picture_url || 'https://kihap.com.br/wp-content/uploads/2021/02/logo-wh.png'
            },
            stories: stories
        };

    } catch (error) {
        console.error("Erro ao buscar Instagram Stories:", error.response ? error.response.data : error.message);
        
        // Tratar erro de token especificamente
        if (error.response && error.response.data && error.response.data.error && error.response.data.error.code === 190) {
            throw new functions.https.HttpsError('unauthenticated', 'O token do Instagram expirou ou é inválido. Por favor, atualize o Access Token na Intranet.');
        }

        throw new functions.https.HttpsError('internal', 'Falha ao carregar stories: ' + (error.response ? error.response.data.error.message : error.message));
    }
};
