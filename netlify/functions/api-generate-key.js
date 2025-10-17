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

    // Parse cookies & auth
    const cookies = event.headers && event.headers.cookie ? cookie.parse(event.headers.cookie) : {};
    const token = cookies.auth_token;
    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { id } = decoded;

        // Verify user exists and get status
        const userRes = await db.query('SELECT user_status FROM users WHERE discord_id = $1', [id]);
        if (userRes.rows.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
        }
        const userStatus = userRes.rows[0].user_status;

        // Free user flow (temporary key)
        if (userStatus === 'Free') {
            // If user already has active temp key, return it
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

            // Parse request body
            let body = {};
            try { body = event.body ? JSON.parse(event.body) : {}; } catch (e) { body = {}; }

            const { hash } = body;
            if (!hash) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Verification hash is missing.' }) };
            }

            // Linkvertise Anti-Bypass verification (POST with token & hash as params)
            const LV_TOKEN = process.env.LINKVERTISE_API_TOKEN; // <- bien lire la variable Netlify
            if (!LV_TOKEN) {
                return {
                    statusCode: 500,
                    body: JSON.stringify({
                        error: 'Server misconfiguration: Linkvertise token not set. Please define LINKVERTISE_API_TOKEN in Netlify environment variables.'
                    })
                };
            }

            const verificationUrl = 'https://publisher.linkvertise.com/api/v1/anti_bypassing';
            let lvResp;
            try {
                const resp = await axios.post(verificationUrl, null, {
                    params: { token: LV_TOKEN, hash: hash },
                    headers: { Accept: 'application/json' },
                    validateStatus: () => true
                });
                lvResp = resp.data;
            } catch (err) {
                const details = err?.response?.data ?? err?.message ?? 'Unknown';
                return { statusCode: 502, body: JSON.stringify({ error: 'Linkvertise verification request failed.', details }) };
            }

            const isValid =
                lvResp === true ||
                (typeof lvResp === 'string' && lvResp.trim().toLowerCase() === 'true') ||
                (typeof lvResp === 'object' && (lvResp.status === true || lvResp.success === true));

            if (!isValid) {
                return {
                    statusCode: 403,
                    body: JSON.stringify({
                        error: 'Linkvertise task not completed or invalid/expired hash.',
                        details: lvResp
                    })
                };
            }

            // Generate and store new temporary key (12h)
            const newKey = `KINGFREE-${generateRandomString(20)}`;
            const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
            await db.query(
                'INSERT INTO keys (key_value, key_type, owner_discord_id, expires_at) VALUES ($1, $2, $3, $4)',
                [newKey, 'temp', id, expiresAt]
            );

            return {
                statusCode: 200,
                body: JSON.stringify({ key: newKey, type: 'temp', expires: expiresAt })
            };
        }

        // Permanent user flow
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
            return { statusCode: 200, body: JSON.stringify({ key: newKey, type: 'perm' }) };
        }

        // Unknown user status
        return { statusCode: 400, body: JSON.stringify({ error: 'Unknown user status.' }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to generate key.', details: error.message }) };
    }
};
