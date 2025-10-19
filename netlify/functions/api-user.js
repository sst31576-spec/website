// netlify/functions/api-user.js
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db');

const { JWT_SECRET } = process.env;

exports.handler = async function(event, context) {
    const cookies = event.headers.cookie ? cookie.parse(event.headers.cookie) : {};
    const token = cookies.session_token;

    if (!token) {
        return { statusCode: 401, body: 'Not authenticated' };
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { discord_id } = decoded;

        // Récupère les données de l'utilisateur
        const { rows } = await db.query(
            `SELECT
                u.discord_id,
                u.discord_username,
                u.discord_avatar,
                u.roles,
                CASE
                    WHEN EXISTS (SELECT 1 FROM keys k WHERE k.discord_id = u.discord_id AND k.key_type = 'perm') THEN 'perm'
                    ELSE 'free'
                END as user_status,
                COALESCE(u.is_admin, false) as "isAdmin"
             FROM users u
             WHERE u.discord_id = $1`,
            [discord_id]
        );

        if (rows.length === 0) {
            return { statusCode: 404, body: 'User not found' };
        }
        
        const user = rows[0];

        // --- CORRECTION CRUCIALE ICI ---
        // On s'assure que les rôles sont un tableau, même s'ils sont nuls ou mal formatés dans la BDD.
        // `JSON.parse` reconvertit le texte en un vrai tableau que JavaScript peut utiliser.
        try {
            // Si user.roles est un string JSON, on le parse. Sinon, on utilise un tableau vide.
            user.roles = typeof user.roles === 'string' ? JSON.parse(user.roles) : [];
        } catch (e) {
            console.error("Failed to parse roles, defaulting to empty array:", user.roles);
            user.roles = []; // Sécurité en cas d'erreur de parsing
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user), // On envoie l'objet utilisateur complet avec les rôles corrigés
        };
    } catch (error) {
        console.error('API User Error:', error.message);
        
        const clearCookie = cookie.serialize('session_token', '', {
            httpOnly: true,
            secure: true,
            path: '/',
            sameSite: 'lax',
            expires: new Date(0)
        });
        return {
            statusCode: 401,
            headers: { 'Set-Cookie': clearCookie },
            body: 'Invalid or expired token'
        };
    }
};
