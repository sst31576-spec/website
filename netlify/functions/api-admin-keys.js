// netlify/functions/api-admin-keys.js
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db'); // Assurez-vous que ce chemin vers votre configuration DB est correct
const axios = require('axios');

// Définir les rôles de manière spécifique
const SUPER_ADMIN_ROLE = '869611811962511451';
const ADMIN_ROLES = [SUPER_ADMIN_ROLE, '1428730376519553186'];

/**
 * Middleware pour vérifier si l'utilisateur est un admin et déterminer son niveau d'accès.
 * @param {object} event - L'objet événement de la fonction Netlify.
 * @returns {Promise<{isSuperAdmin: boolean}>} Un objet indiquant si l'utilisateur est un super-admin.
 * @throws {Error} Lance une erreur si l'utilisateur n'est pas authentifié ou n'a pas la permission.
 */
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
    
    const userRoles = memberResponse.data.roles;
    const hasAdminRole = userRoles.some(roleId => ADMIN_ROLES.includes(roleId));
    
    if (!hasAdminRole) throw new Error('Forbidden');

    // Vérifier si l'utilisateur a le rôle de super-admin
    const isSuperAdmin = userRoles.includes(SUPER_ADMIN_ROLE);
    
    // Retourner un objet avec les informations de permission
    return { isSuperAdmin };
};

exports.handler = async function (event, context) {
    let verificationResult;
    try {
        verificationResult = await verifyAdmin(event);
    } catch (error) {
        if (error.message === 'Not authenticated') return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
        if (error.message === 'Forbidden') return { statusCode: 403, body: JSON.stringify({ error: 'You do not have permission.' }) };
        return { statusCode: 500, body: JSON.stringify({ error: 'An internal error occurred during verification.' }) };
    }

    try {
        // GET: Récupérer toutes les clés avec filtrage de données
        if (event.httpMethod === 'GET') {
            const { rows } = await db.query(`
                SELECT k.id, k.key_value, k.key_type, k.roblox_user_id, k.owner_discord_id, u.discord_username, k.expires_at
                FROM keys k
                LEFT JOIN users u ON k.owner_discord_id = u.discord_id
                ORDER BY k.created_at DESC
            `);

            // Traiter les données avant de les envoyer au client
            const processedRows = rows.map(key => {
                // Si la clé est de type 'perm' ET que l'utilisateur n'est PAS un super-admin
                if (key.key_type === 'perm' && !verificationResult.isSuperAdmin) {
                    // Remplacer la valeur du HWID par "PRIVATE"
                    return { ...key, roblox_user_id: 'PRIVATE' };
                }
                // Sinon, retourner la clé sans modification
                return key;
            });

            return { statusCode: 200, body: JSON.stringify(processedRows) };
        }

        // DELETE: Supprimer une clé ou les clés expirées
        if (event.httpMethod === 'DELETE') {
            const body = JSON.parse(event.body);

            // Supprimer en masse les clés temporaires expirées
            if (body.action && body.action === 'delete_expired') {
                const result = await db.query("DELETE FROM keys WHERE key_type = 'temp' AND expires_at < NOW()");
                return { 
                    statusCode: 200, 
                    body: JSON.stringify({ success: true, message: `${result.rowCount} expired key(s) deleted.` }) 
                };
            } 
            // Supprimer une seule clé par son ID
            else if (body.key_id) {
                await db.query('DELETE FROM keys WHERE id = $1', [body.key_id]);
                return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Key deleted.' }) };
            } 
            // Requête invalide
            else {
                return { statusCode: 400, body: JSON.stringify({ error: 'Request must contain a key_id or a valid action.' }) };
            }
        }

        // PUT: Mettre à jour une clé (HWID et/ou date d'expiration)
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

        // Méthode HTTP non autorisée
        return { statusCode: 405, body: 'Method Not Allowed' };
    } catch (error) {
        console.error('Admin Keys Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'An internal server error occurred.' }) };
    }
};
