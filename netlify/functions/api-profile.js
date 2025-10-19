// netlify/functions/api-profile.js
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db');

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // --- Authentification ---
    const cookies = event.headers?.cookie ? cookie.parse(event.headers.cookie) : {};
    const token = cookies.auth_token;
    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { id } = decoded;

        // --- Récupérer les données de l'utilisateur et de sa clé ---
        const { rows } = await db.query(`
            SELECT 
                u.discord_username,
                u.king_game_coins,
                u.total_time_earned,
                k.key_type,
                k.script_executions
            FROM users u
            LEFT JOIN keys k ON u.discord_id = k.owner_discord_id
            WHERE u.discord_id = $1
        `, [id]);

        if (rows.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: 'User data not found.' }) };
        }

        const profileData = rows[0];

        return {
            statusCode: 200,
            body: JSON.stringify(profileData)
        };

    } catch (error) {
        console.error('Profile API Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'An internal server error occurred.' }) };
    }
};
