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

        // DELETE: Remove a key OR all expired keys
        if (event.httpMethod === 'DELETE') {
            const body = JSON.parse(event.body);

            // NOUVELLE LOGIQUE: Supprimer toutes les clés expirées
            if (body.action === 'delete_expired') {
                const result = await db.query("DELETE FROM keys WHERE key_type = 'temp' AND expires_at < NOW()");
                return { 
                    statusCode: 200, 
                    body: JSON.stringify({ 
                        success: true, 
                        message: `${result.rowCount} expired key(s) deleted.` 
                    }) 
                };
            }

            // ANCIENNE LOGIQUE: Supprimer une seule clé
            const { key_id } = body;
            if (!key_id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing key_id' }) };
            await db.query('DELETE FROM keys WHERE id = $1', [key_id]);
            return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Key deleted.' }) };
        }

        // PUT: Update key properties (HWID and/or Expiration)
        if (event.httpMethod === 'PUT') {
            const body = JSON.parse(event.body);
            const { key_id } = body;
            
            if (!key_id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing key_id' }) };

            let updateParts = [];
            let params = [];
            let paramIndex = 1;
            
            if (body.new_roblox_user_id !== undefined) {
                const finalRobloxId = (body.new_roblox_user_id && body.new_roblox_user_id.trim() !== '') ? body.new_roblox_user_id.trim() : null;
                updateParts.push(`roblox_user_id = $${paramIndex++}`);
                params.push(finalRobloxId);
            }

            if (body.new_expires_at !== undefined) {
                const finalExpiresAt = (body.new_expires_at === null) ? null : new Date(body.new_expires_at);
                updateParts.push(`expires_at = $${paramIndex++}`);
                params.push(finalExpiresAt);
            }

            if (updateParts.length === 0) {
                 return { statusCode: 400, body: JSON.stringify({ error: 'No fields provided for update.' }) };
            }

            const updateQuery = `UPDATE keys SET ${updateParts.join(', ')} WHERE id = $${paramIndex}`;
            params.push(key_id);
            
            await db.query(updateQuery, params);
            
            return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Key updated successfully.' }) };
        }

        return { statusCode: 405, body: 'Method Not Allowed' };
    } catch (error) {
        console.error('Admin Keys Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'An internal server error occurred.' }) };
    }
};
