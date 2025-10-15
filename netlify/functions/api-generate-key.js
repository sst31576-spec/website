// netlify/functions/api-generate-key.js
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db');

const generateRandomString = (length) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
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

        const { rows } = await db.query('SELECT user_status FROM users WHERE discord_id = $1', [id]);
        if (rows.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
        }
        
        const userStatus = rows[0].user_status;

        if (userStatus === 'Free') {
            const { rows: existingKeyRows } = await db.query(
                'SELECT key_value, expires_at FROM keys WHERE owner_discord_id = $1 AND key_type = $2 AND expires_at > NOW()',
                [id, 'temp']
            );

            if (existingKeyRows.length > 0) {
                return { statusCode: 200, body: JSON.stringify({ key: existingKeyRows[0].key_value, type: 'temp', expires: existingKeyRows[0].expires_at }) };
            }
            
            const { completed_task } = JSON.parse(event.body);
            if (completed_task !== true) {
                return { statusCode: 403, body: JSON.stringify({ error: 'Linkvertise task verification failed.' }) };
            }

            const newKey = `KINGFREE-${generateRandomString(20)}`;
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await db.query('INSERT INTO keys (key_value, key_type, owner_discord_id, expires_at) VALUES ($1, $2, $3, $4)', [newKey, 'temp', id, expiresAt]);
            return { statusCode: 200, body: JSON.stringify({ key: newKey, type: 'temp', expires: expiresAt }) };
        }

        if (userStatus === 'Perm') {
            const { rows: existingRows } = await db.query('SELECT key_value FROM keys WHERE owner_discord_id = $1 AND key_type = $2', [id, 'perm']);
            let newKey;
            if (existingRows.length > 0) {
                newKey = existingRows[0].key_value;
            } else {
                newKey = `KINGPERM-${generateRandomString(16)}`;
                await db.query('INSERT INTO keys (key_value, key_type, owner_discord_id) VALUES ($1, $2, $3)', [newKey, 'perm', id]);
            }
            return { statusCode: 200, body: JSON.stringify({ key: newKey, type: 'perm' }) };
        }
        
    } catch (error) {
        console.error('Key Generation Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to generate key.' }) };
    }
};
