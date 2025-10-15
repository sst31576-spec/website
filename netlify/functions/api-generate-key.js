const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db');
const axios = require('axios');

const generateRandomString = (length) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    const cookies = event.headers.cookie ? cookie.parse(event.headers.cookie) : {};
    const token = cookies.auth_token;
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { id } = decoded;

        const { rows } = await db.query('SELECT user_status FROM users WHERE discord_id = $1', [id]);
        if (rows.length === 0) return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };

        const userStatus = rows[0].user_status;

        // ---- Free user flow ----
        if (userStatus === 'Free') {
            // Check if user already has an active temp key
            const { rows: existingKeyRows } = await db.query(
                'SELECT * FROM keys WHERE owner_discord_id = $1 AND key_type = $2 AND expires_at > NOW()',
                [id, 'temp']
            );
            if (existingKeyRows.length > 0) {
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        key: existingKeyRows[0].key_value,
                        type: 'temp',
                        expires: existingKeyRows[0].expires_at
                    })
                };
            }

            let body = {};
            try { body = event.body ? JSON.parse(event.body) : {}; } catch (err) {}

            const { hash } = body;
            if (!hash) return { statusCode: 400, body: JSON.stringify({ error: 'Verification hash is missing.' }) };

            // Linkvertise verification
            const LINKVERTISE_ID = process.env.LINKVERTISE_ID || "1409420"; 
            const LV_TOKEN = process.env.LINKVERTISE_TOKEN || ""; // ton token anti-bypass
            const verificationUrl = `https://publisher.linkvertise.com/api/v1/anti_bypassing?token=${LV_TOKEN}&hash=${encodeURIComponent(hash)}`;

            let lvResponse;
            try {
                const response = await axios.post(verificationUrl);
                lvResponse = response.data;
            } catch (err) {
                const respData = err.response ? err.response.data : err.message;
                return {
                    statusCode: 502,
                    body: JSON.stringify({ error: 'Linkvertise verification request failed.', details: respData })
                };
            }

            const isValid = lvResponse && ((typeof lvResponse === 'boolean' && lvResponse === true) || (typeof lvResponse === 'object' && lvResponse.status === true));

            if (!isValid) {
                return {
                    statusCode: 403,
                    body: JSON.stringify({
                        error: 'Linkvertise task not completed or invalid/expired hash.',
                        details: lvResponse
                    })
                };
            }

            // Generate new temp key
            const newKey = `KINGFREE-${generateRandomString(20)}`;
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await db.query(
                'INSERT INTO keys (key_value, key_type, owner_discord_id, expires_at) VALUES ($1, $2, $3, $4)',
                [newKey, 'temp', id, expiresAt]
            );

            return {
                statusCode: 200,
                body: JSON.stringify({ key: newKey, type: 'temp', expires: expiresAt })
            };
        }

        // ---- Permanent user flow ----
        if (userStatus === 'Perm') {
            const { rows: existingRows } = await db.query(
                'SELECT key_value FROM keys WHERE owner_discord_id = $1 AND key_type = $2',
                [id, 'perm']
            );
            let newKey;
            if (existingRows.length > 0) newKey = existingRows[0].key_value;
            else {
                newKey = `KINGPERM-${generateRandomString(16)}`;
                await db.query(
                    'INSERT INTO keys (key_value, key_type, owner_discord_id) VALUES ($1, $2, $3)',
                    [newKey, 'perm', id]
                );
            }
            return { statusCode: 200, body: JSON.stringify({ key: newKey, type: 'perm' }) };
        }

        return { statusCode: 400, body: JSON.stringify({ error: 'Unknown user status.' }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to generate key.' }) };
    }
};
