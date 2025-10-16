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

        // 1. VÉRIFIER SI UNE CLÉ ACTIVE EXISTE DÉJÀ (POUR TOUS LES STATUTS)
        const keyTypeToCheck = userStatus === 'Perm' ? 'perm' : 'temp';
        const query = userStatus === 'Perm' 
            ? 'SELECT * FROM keys WHERE owner_discord_id = $1 AND key_type = $2'
            : 'SELECT * FROM keys WHERE owner_discord_id = $1 AND key_type = $2 AND expires_at > NOW()';
        
        const { rows: existingKeyRows } = await db.query(query, [id, keyTypeToCheck]);

        if (existingKeyRows.length > 0) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    key: existingKeyRows[0].key_value,
                    type: existingKeyRows[0].key_type,
                    expires: existingKeyRows[0].expires_at
                })
            };
        }

        // 2. SI AUCUNE CLÉ ACTIVE N'EST TROUVÉE
        if (userStatus === 'Perm') {
            // Crée une clé permanente s'il n'en avait pas
            const newKey = `KINGPERM-${generateRandomString(16)}`;
            await db.query('INSERT INTO keys (key_value, key_type, owner_discord_id) VALUES ($1, $2, $3)', [newKey, 'perm', id]);
            return { statusCode: 200, body: JSON.stringify({ key: newKey, type: 'perm' }) };
        }

        if (userStatus === 'Free') {
            // Pour les utilisateurs 'Free', on a besoin de la vérification Linkvertise
            let body = {};
            try { body = event.body ? JSON.parse(event.body) : {}; } catch (e) { /* ignore parsing errors */ }
            const { hash } = body;

            // SI PAS DE HASH, on dit au frontend d'afficher les boutons "Start Task"
            if (!hash) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Verification required.' }) };
            }

            // SI UN HASH EST FOURNI, on le valide
            const LV_TOKEN = process.env.LINKVERTISE_API_TOKEN;
            if (!LV_TOKEN) throw new Error('Server misconfiguration: Linkvertise token not set.');

            const verificationUrl = 'https://publisher.linkvertise.com/api/v1/anti_bypassing';
            const lvResp = await axios.post(verificationUrl, null, { params: { token: LV_TOKEN, hash } });

            if (lvResp.data.success !== true) {
                return { statusCode: 403, body: JSON.stringify({ error: 'Linkvertise task not completed.', details: lvResp.data }) };
            }

            // La validation a réussi, on génère la clé de 24h
            const newKey = `KINGFREE-${generateRandomString(20)}`;
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            
            // On nettoie les anciennes clés 'temp' avant d'insérer la nouvelle
            await db.query("DELETE FROM keys WHERE owner_discord_id = $1 AND key_type = 'temp'", [id]);
            await db.query('INSERT INTO keys (key_value, key_type, owner_discord_id, expires_at) VALUES ($1, $2, $3, $4)', [newKey, 'temp', id, expiresAt]);

            return { statusCode: 200, body: JSON.stringify({ key: newKey, type: 'temp', expires: expiresAt }) };
        }

        // Statut inconnu
        return { statusCode: 400, body: JSON.stringify({ error: 'Unknown user status.' }) };

    } catch (error) {
        console.error('API Generate Key Error:', error.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error', details: error.message }) };
    }
};
