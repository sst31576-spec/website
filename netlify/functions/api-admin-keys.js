// netlify/functions/api-admin-keys.js
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db');
const axios = require('axios');

const ADMIN_ROLES = ['869611811962511451', '877989445725483009'];

// Middleware function to verify if the user is an admin
const verifyAdmin = async (event) => {
    const cookies = event.headers.cookie ? cookie.parse(event.headers.cookie) : {};
    const token = cookies.auth_token;
    if (!token) throw new Error('Not authenticated');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id } = decoded;

    const memberResponse = await axios.get(
        `https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/members/${id}`,
        { headers: { 'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
    );

    const hasAdminRole = memberResponse.data.roles.some(roleId => ADMIN_ROLES.includes(roleId));
    if (!hasAdminRole) throw new Error('Forbidden');
};

exports.handler = async function (event, context) {
    try {
        await verifyAdmin(event);
    } catch (error) {
        if (error.message === 'Not authenticated') return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
        if (error.message === 'Forbidden') return { statusCode: 403, body: JSON.stringify({ error: 'You do not have permission.' }) };
        return { statusCode: 500, body: JSON.stringify({ error: 'An internal error occurred during verification.' }) };
    }

    try {
        // GET: Fetch all keys
        if (event.httpMethod === 'GET') {
            const { rows } = await db.query(`
                SELECT k.id, k.key_value, k.key_type, k.roblox_user_id, k.owner_discord_id, u.discord_username, k.expires_at
                FROM keys k
                LEFT JOIN users u ON k.owner_discord_id = u.discord_id
                ORDER BY k.created_at DESC
            `);
            return { statusCode: 200, body: JSON.stringify(rows) };
        }

        // DELETE: Remove a key
        if (event.httpMethod === 'DELETE') {
            const { key_id } = JSON.parse(event.body);
            if (!key_id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing key_id' }) };

            await db.query('DELETE FROM keys WHERE id = $1', [key_id]);
            return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Key deleted.' }) };
        }

        // FIX: Mise à jour pour inclure la date d'expiration
        if (event.httpMethod === 'PUT') {
            const { key_id, new_roblox_user_id, new_expires_at } = JSON.parse(event.body);
            if (!key_id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing key_id' }) };

            const finalRobloxId = (new_roblox_user_id && new_roblox_user_id.trim() !== '') ? new_roblox_user_id.trim() : null;

            // Construction dynamique de la requête de mise à jour
            let query = 'UPDATE keys SET roblox_user_id = $1';
            const params = [finalRobloxId];
            
            // new_expires_at doit être présent dans le body de la requête pour être traité
            if (new_expires_at !== undefined) {
                // Si new_expires_at est une chaîne vide ou NULL, on le met à NULL dans la DB. Sinon, on le convertit en ISO
                const finalExpiresAt = (new_expires_at && new_expires_at.trim() !== '') ? new Date(new_expires_at).toISOString() : null;
                query += `, expires_at = $${params.length + 1}`;
                params.push(finalExpiresAt);
            }

            // Ajout de la clause WHERE key_id
            query += ` WHERE id = $${params.length + 1}`;
            params.push(key_id);
            
            await db.query(query, params);
            
            return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Key updated.' }) };
        }

        return { statusCode: 405, body: 'Method Not Allowed' };
    } catch (error) {
        console.error('Admin Keys Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'An internal server error occurred.' }) };
    }
};
