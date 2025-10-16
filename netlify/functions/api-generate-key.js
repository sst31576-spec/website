// netlify/functions/api-generate-key.js
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db');
const axios = require('axios');

// Fonction utilitaire pour générer une chaîne aléatoire pour les clés
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

        // Vérifie si l'utilisateur existe et récupère son statut
        const userRes = await db.query('SELECT user_status FROM users WHERE discord_id = $1', [id]);
        if (userRes.rows.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
        }
        const userStatus = userRes.rows[0].user_status;

        // Flux utilisateur GRATUIT (clé temporaire de 24h)
        if (userStatus === 'Free') {
            // 1. Vérifie si une clé temporaire VALIDE existe déjà
            const { rows: existingRows } = await db.query(
                "SELECT key_value, expires_at FROM keys WHERE owner_discord_id = $1 AND key_type = 'temp' AND expires_at > NOW()",
                [id]
            );

            if (existingRows.length > 0) {
                // Clé valide existante trouvée, la retourne
                const existingKey = existingRows[0].key_value;
                const expires = existingRows[0].expires_at;
                return {
                    statusCode: 200,
                    body: JSON.stringify({ key: existingKey, type: 'temp', expires: expires })
                };
            }

            // 2. Aucune clé valide, génère une nouvelle clé
            const newKey = `KINGFREE-${generateRandomString(16)}`;
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

            // *** MODIFICATION POUR LE NETTOYAGE DB ***
            // Supprime toute ancienne clé temporaire de cet utilisateur avant d'en insérer une nouvelle.
            // Ceci assure que l'utilisateur n'a qu'une seule clé temporaire à la fois et maintient la DB propre.
            await db.query(
                'DELETE FROM keys WHERE owner_discord_id = $1 AND key_type = $2',
                [id, 'temp']
            );
            // *** FIN MODIFICATION ***
            
            // Insère la nouvelle clé temporaire (24h)
            await db.query(
                'INSERT INTO keys (key_value, key_type, owner_discord_id, expires_at) VALUES ($1, $2, $3, $4)',
                [newKey, 'temp', id, expiresAt]
            );

            return {
                statusCode: 200,
                body: JSON.stringify({ key: newKey, type: 'temp', expires: expiresAt })
            };
        }

        // Flux utilisateur PERMANENT
        if (userStatus === 'Perm') {
            // 1. Vérifie si une clé permanente existe déjà
            const { rows: existingRows } = await db.query(
                'SELECT key_value FROM keys WHERE owner_discord_id = $1 AND key_type = $2',
                [id, 'perm']
            );
            let newKey;
            if (existingRows.length > 0) {
                // Clé permanente existante trouvée, la retourne (elle est fixe)
                newKey = existingRows[0].key_value;
            } else {
                // Aucune clé permanente trouvée, en génère une
                newKey = `KINGPERM-${generateRandomString(16)}`;
                await db.query(
                    'INSERT INTO keys (key_value, key_type, owner_discord_id) VALUES ($1, $2, $3)',
                    [newKey, 'perm', id]
                );
            }
            return { statusCode: 200, body: JSON.stringify({ key: newKey, type: 'perm' }) };
        }

        // Statut utilisateur inconnu
        return { statusCode: 400, body: JSON.stringify({ error: 'Unknown user status.' }) };

    } catch (error) {
        console.error('API Generate Key Error:', error.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
    }
};
