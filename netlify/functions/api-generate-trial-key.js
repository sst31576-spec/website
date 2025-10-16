// netlify/functions/api-generate-trial-key.js
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db');

const generateRandomString = (length) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
};

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const cookies = event.headers.cookie ? cookie.parse(event.headers.cookie) : {};
    const token = cookies.auth_token;
    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { id } = decoded;

        const userRes = await db.query('SELECT user_status FROM users WHERE discord_id = $1', [id]);
        if (userRes.rows.length === 0 || userRes.rows[0].user_status !== 'Free') {
            return { statusCode: 403, body: JSON.stringify({ error: 'This feature is only for Free users.' }) };
        }

        // Anti-abus : Vérifie si une clé active (temp ou trial) existe déjà
        const { rows: existingKeyRows } = await db.query(
            'SELECT key_value FROM keys WHERE owner_discord_id = $1 AND expires_at > NOW()',
            [id]
        );
        if (existingKeyRows.length > 0) {
            return { statusCode: 429, body: JSON.stringify({ error: 'You already have an active key. Please wait for it to expire.' }) };
        }

        // Aucune clé active trouvée, on génère une clé d'essai de 10 minutes
        const newKey = `KINGTRIAL-${generateRandomString(18)}`;
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        const keyType = 'trial';

        // Nettoie les anciennes clés de cet utilisateur avant d'insérer la nouvelle
        await db.query("DELETE FROM keys WHERE owner_discord_id = $1 AND (key_type = 'temp' OR key_type = 'trial')", [id]);
        
        await db.query(
            'INSERT INTO keys (key_value, key_type, owner_discord_id, expires_at) VALUES ($1, $2, $3, $4)',
            [newKey, keyType, id, expiresAt]
        );

        return {
            statusCode: 200,
            body: JSON.stringify({ key: newKey, type: keyType, expires: expiresAt })
        };

    } catch (error) {
        console.error('Trial Key Generation Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'An internal error occurred.' }) };
    }
};
