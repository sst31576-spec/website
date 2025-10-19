// netlify/functions/api-earn-time.js
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db');

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Parse les cookies pour trouver le token d'authentification
    const cookies = event.headers && event.headers.cookie ? cookie.parse(event.headers.cookie) : {};
    const token = cookies.auth_token;
    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    try {
        // Vérifie le token et récupère l'ID Discord de l'utilisateur
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { id } = decoded;

        // Cherche une clé de type 'temp' qui n'a pas encore expiré pour cet utilisateur
        const { rows } = await db.query(
            'SELECT key_value, expires_at FROM keys WHERE owner_discord_id = $1 AND key_type = $2 AND expires_at > NOW()',
            [id, 'temp']
        );

        // Si aucune clé active n'est trouvée
        if (rows.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'You do not have an active temporary key to play with.' })
            };
        }

        // Si une clé est trouvée, retourne sa date d'expiration
        const keyData = rows[0];
        return {
            statusCode: 200,
            body: JSON.stringify({
                expires_at: keyData.expires_at
            })
        };

    } catch (error) {
        console.error('Earn Time API Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'An internal server error occurred.' }) };
    }
};
