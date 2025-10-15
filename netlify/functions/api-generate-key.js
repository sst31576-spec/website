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
    console.log("Incoming request:", event.httpMethod, event.body);

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // --- Parse cookies & auth ---
    const cookies = event.headers.cookie ? cookie.parse(event.headers.cookie) : {};
    const token = cookies.auth_token;
    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { id } = decoded;

        // Vérifie si l’utilisateur existe
        const { rows } = await db.query('SELECT user_status FROM users WHERE discord_id = $1', [id]);
        if (rows.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
        }

        const userStatus = rows[0].user_status;

        // ==== FREE USERS ====
        if (userStatus === 'Free') {
            // 🔁 Vérifie si un key temporaire actif existe déjà
            const { rows: existingKeyRows } = await db.query(
                'SELECT * FROM keys WHERE owner_discord_id = $1 AND key_type = $2 AND expires_at > NOW()',
                [id, 'temp']
            );

            if (existingKeyRows.length > 0) {
                console.log(`Existing temp key for user ${id} found.`);
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        key: existingKeyRows[0].key_value,
                        type: 'temp',
                        expires: existingKeyRows[0].expires_at
                    })
                };
            }

            // --- Parse request body ---
            let body = {};
            try {
                body = event.body ? JSON.parse(event.body) : {};
            } catch (err) {
                console.error('Failed to parse body JSON:', err.message);
            }

            const { hash } = body;
            if (!hash) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Verification hash is missing.' }) };
            }

            // ==== LINKVERTISE VERIFICATION (NOUVELLE VERSION STABLE) ====
            const LINKVERTISE_ID = "1409420"; // Ton vrai ID Linkvertise
            const verificationUrl = `https://publisher.linkvertise.com/api/v1/redirect/link?id=${LINKVERTISE_ID}&hash=${encodeURIComponent(hash)}&o=sharing`;

            console.log("Checking Linkvertise verification:", verificationUrl);

            let response;
            try {
                response = await axios.get(verificationUrl, {
                    headers: {
                        "User-Agent": "KeySystem/1.0",
                        "Accept": "application/json"
                    },
                    validateStatus: () => true
                });
            } catch (err) {
                const respData = err.response ? err.response.data : err.message;
                console.error("Axios error calling Linkvertise:", respData);
                return {
                    statusCode: 502,
                    body: JSON.stringify({
                        error: 'Linkvertise verification request failed.',
                        details: respData
                    })
                };
            }

            console.log("Linkvertise API Raw:", response.status, response.data);

            // Vérifie les formats valides de retour possibles
            const valid =
                response.status === 200 &&
                (response.data?.data?.valid === true ||
                    response.data?.success === true ||
                    response.data?.valid === true);

            if (!valid) {
                return {
                    statusCode: 403,
                    body: JSON.stringify({
                        error: 'Linkvertise task not completed or invalid hash.',
                        details: response.data || { status: response.status }
                    })
                };
            }

            // ==== GÉNÉRATION DE LA CLÉ ====
            const newKey = `KINGFREE-${generateRandomString(20)}`;
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
            await db.query(
                'INSERT INTO keys (key_value, key_type, owner_discord_id, expires_at) VALUES ($1, $2, $3, $4)',
                [newKey, 'temp', id, expiresAt]
            );

            console.log(`Generated new temp key for user ${id}: ${newKey}`);

            return {
                statusCode: 200,
                body: JSON.stringify({ key: newKey, type: 'temp', expires: expiresAt })
            };
        }

        // ==== PERMANENT USERS ====
        if (userStatus === 'Perm') {
            const { rows: existingRows } = await db.query(
                'SELECT key_value FROM keys WHERE owner_discord_id = $1 AND key_type = $2',
                [id, 'perm']
            );

            let newKey;
            if (existingRows.length > 0) {
                newKey = existingRows[0].key_value;
            } else {
                newKey = `KINGPERM-${generateRandomString(16)}`;
                await db.query(
                    'INSERT INTO keys (key_value, key_type, owner_discord_id) VALUES ($1, $2, $3)',
                    [newKey, 'perm', id]
                );
            }

            console.log(`Permanent key for ${id}: ${newKey}`);
            return { statusCode: 200, body: JSON.stringify({ key: newKey, type: 'perm' }) };
        }

        // ==== UNKNOWN STATUS ====
        return { statusCode: 400, body: JSON.stringify({ error: 'Unknown user status.' }) };
    } catch (error) {
        console.error('Key Generation Error:', error && error.stack ? error.stack : error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to generate key.' }) };
    }
};
