// netlify/functions/api-generate-key.js
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db');
const axios = require('axios');

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
        if (userRes.rows.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
        }
        const userStatus = userRes.rows[0].user_status;

        // --- Logique pour les utilisateurs PERM (inchangée) ---
        if (userStatus === 'Perm') {
            const { rows: existingRows } = await db.query("SELECT key_value FROM keys WHERE owner_discord_id = $1 AND key_type = 'perm'", [id]);
            let permKey;
            if (existingRows.length > 0) {
                permKey = existingRows[0].key_value;
            } else {
                permKey = `KINGPERM-${generateRandomString(16)}`;
                await db.query('INSERT INTO keys (key_value, key_type, owner_discord_id) VALUES ($1, $2, $3)', [permKey, 'perm', id]);
            }
            return { statusCode: 200, body: JSON.stringify({ key: permKey, type: 'perm' }) };
        }

        // --- Logique pour les utilisateurs FREE ---
        if (userStatus === 'Free') {
            // 1. Vérifie si une clé 'temp' valide existe déjà
            const { rows: existingRows } = await db.query("SELECT * FROM keys WHERE owner_discord_id = $1 AND key_type = 'temp' AND expires_at > NOW()", [id]);
            if (existingRows.length > 0) {
                return { statusCode: 200, body: JSON.stringify({ key: existingRows[0].key_value, type: 'temp', expires: existingRows[0].expires_at }) };
            }

            // 2. Si aucune clé valide, exige la validation Linkvertise
            let body = {};
            try { body = event.body ? JSON.parse(event.body) : {}; } catch (e) { /* ignore */ }
            const { hash } = body;

            // Si le frontend n'envoie pas de hash, on lui dit d'afficher les boutons
            if (!hash) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Verification required.' }) };
            }

            // Si un hash est fourni, on le valide auprès de Linkvertise
            const LV_TOKEN = process.env.LINKVERTISE_API_TOKEN;
            if (!LV_TOKEN) throw new Error('Server misconfiguration: Linkvertise token not set.');

            const verificationUrl = 'https://publisher.linkvertise.com/api/v1/anti_bypassing';
            const lvResponse = await axios.post(verificationUrl, null, { params: { token: LV_TOKEN, hash } });
            
            const isSuccess = lvResponse.data && (lvResponse.data === true || lvResponse.data.success === true || (typeof lvResponse.data.success === 'string' && lvResponse.data.success.toLowerCase() === 'true'));
            
            if (!isSuccess) {
                return { statusCode: 403, body: JSON.stringify({ error: 'Linkvertise task not completed.', details: lvResponse.data }) };
            }

            // 3. Validation réussie, on génère la clé de 24h
            const newKey = `KINGFREE-${generateRandomString(20)}`;
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            
            await db.query("DELETE FROM keys WHERE owner_discord_id = $1 AND key_type = 'temp'", [id]);
            await db.query('INSERT INTO keys (key_value, key_type, owner_discord_id, expires_at) VALUES ($1, $2, $3, $4)', [newKey, 'temp', id, expiresAt]);

            return { statusCode: 200, body: JSON.stringify({ key: newKey, type: 'temp', expires: expiresAt }) };
        }

        return { statusCode: 400, body: JSON.stringify({ error: 'Unknown user status.' }) };

    } catch (error) {
        console.error('API Generate Key Error:', error.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
    }
};
