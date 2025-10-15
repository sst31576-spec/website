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
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    // parse cookies & auth
    const cookies = event.headers.cookie ? cookie.parse(event.headers.cookie) : {};
    const token = cookies.auth_token;
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { id } = decoded;

        const { rows } = await db.query('SELECT user_status FROM users WHERE discord_id = $1', [id]);
        if (rows.length === 0) return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };

        const userStatus = rows[0].user_status;

        // ---- Free user flow (temporary key) ----
        if (userStatus === 'Free') {
            // If user already has an active temp key, return it
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

            // Now we expect a verification hash in the body
            let body = {};
            try {
                body = event.body ? JSON.parse(event.body) : {};
            } catch (err) {
                // If body parse fails, keep body = {}
                console.error('Failed to parse body JSON:', err.message);
            }

            const { hash } = body;
            if (!hash) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Verification hash is missing.' }) };
            }

            if (!process.env.LINKVERTISE_API_TOKEN) {
                console.error('LINKVERTISE_API_TOKEN is not set in environment.');
                return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfiguration.' }) };
            }

            const verificationUrl = `https://publisher.linkvertise.com/api/v1/anti_bypassing?token=${encodeURIComponent(process.env.LINKVERTISE_API_TOKEN)}&hash=${encodeURIComponent(hash)}`;

            let response;
            try {
                // axios.post with an explicit empty body
                response = await axios.post(verificationUrl, {});
            } catch (err) {
                // Log details for debugging
                const respData = err.response ? err.response.data : err.message;
                console.error('Axios error calling Linkvertise:', respData);
                return { statusCode: 502, body: JSON.stringify({ error: 'Linkvertise verification request failed.', details: respData }) };
            }

            // Log Linkvertise reply for debugging
            console.log('Linkvertise response data:', response.data);

            // Normalize response: accept boolean true or string "TRUE"/"true"
            const respNormalized = (typeof response.data === 'string')
                ? response.data.trim().toLowerCase()
                : String(response.data).toLowerCase();

            if (respNormalized !== 'true') {
                // return details to the frontend to aid debugging (don't leak secrets)
                return { statusCode: 403, body: JSON.stringify({ error: 'Linkvertise task not completed or already claimed.', details: response.data }) };
            }

            // If we reach here, verification passed
            const newKey = `KINGFREE-${generateRandomString(20)}`;
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
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
            const { rows: existingRows } = await db.query('SELECT key_value FROM keys WHERE owner_discord_id = $1 AND key_type = $2', [id, 'perm']);
            let newKey;
            if (existingRows.length > 0) newKey = existingRows[0].key_value;
            else {
                newKey = `KINGPERM-${generateRandomString(16)}`;
                await db.query('INSERT INTO keys (key_value, key_type, owner_discord_id) VALUES ($1, $2, $3)', [newKey, 'perm', id]);
            }
            return { statusCode: 200, body: JSON.stringify({ key: newKey, type: 'perm' }) };
        }

        // If user_status not recognized
        return { statusCode: 400, body: JSON.stringify({ error: 'Unknown user status.' }) };
    } catch (error) {
        console.error('Key Generation Error:', error && error.stack ? error.stack : error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to generate key.' }) };
    }
};
