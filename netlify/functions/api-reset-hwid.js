// netlify/functions/api-reset-hwid.js
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db');

const COOLDOWN_HOURS = 24;

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

        const { rows: userRows } = await db.query('SELECT last_hwid_reset FROM users WHERE discord_id = $1', [id]);
        if (userRows.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
        }

        const lastReset = userRows[0].last_hwid_reset;
        if (lastReset) {
            const cooldownEnd = new Date(lastReset).getTime() + COOLDOWN_HOURS * 60 * 60 * 1000;
            if (Date.now() < cooldownEnd) {
                const remainingMs = cooldownEnd - Date.now();
                const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
                return { statusCode: 429, body: JSON.stringify({ error: `You can reset your HWID again in ${remainingHours} hours.` }) };
            }
        }
        
        // Reset HWID only for keys owned by this user
        await db.query('UPDATE keys SET roblox_user_id = NULL WHERE owner_discord_id = $1', [id]);
        await db.query('UPDATE users SET last_hwid_reset = CURRENT_TIMESTAMP WHERE discord_id = $1', [id]);

        return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Your HWID has been successfully reset.' }) };

    } catch (error) {
        console.error('HWID Reset Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'An internal error occurred.' }) };
    }
};
