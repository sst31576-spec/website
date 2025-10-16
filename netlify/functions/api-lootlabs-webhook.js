// netlify/functions/api-lootlabs-webhook.js
const db = require('./db');
const querystring = require('querystring');

// Fonction utilitaire pour générer la clé (Assurez-vous qu'elle est définie)
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

    const data = querystring.parse(event.body);

    // 1. VÉRIFICATION DU SECRET (Doit correspondre à la variable Netlify: LOOTLABS_WEBHOOK_SECRET)
    const providedSecret = data.secret; 
    const expectedSecret = process.env.LOOTLABS_WEBHOOK_SECRET;

    if (!expectedSecret || providedSecret !== expectedSecret) {
        console.error('Webhook Secret Mismatch or Missing Secret');
        return { statusCode: 403, body: 'Forbidden: Secret token mismatch.' };
    }

    // 2. EXTRACTION DE L'ID UTILISATEUR ET DU STATUT
    const discordId = data.subid; // Clé transmise par le site
    const completionStatus = data.status; 
    const successValue = 'complete'; // Valeur de statut de succès LootLabs

    if (!discordId || completionStatus !== successValue) {
        return { statusCode: 200, body: 'OK: Missing discordId or offer not successfully completed.' };
    }

    try {
        // 3. VÉRIFICATION DE L'ÉLIGIBILITÉ
        const userRes = await db.query('SELECT user_status FROM users WHERE discord_id = $1', [discordId]);
        if (userRes.rows.length === 0 || userRes.rows[0].user_status !== 'Free') { 
            return { statusCode: 200, body: 'OK: User not eligible (status is not Free).' };
        }

        // Vérifie si l'utilisateur n'a pas déjà une clé temporaire valide
        const existingKeyRes = await db.query(
            'SELECT key_value FROM keys WHERE owner_discord_id = $1 AND key_type = $2 AND expires_at > NOW()',
            [discordId, 'temp']
        );
        
        if (existingKeyRes.rows.length > 0) {
            return { statusCode: 200, body: 'OK: User already has a valid temp key.' };
        }

        // 4. GÉNÉRATION ET INSERTION DE CLÉ
        const newKey = `KINGTEMP-${generateRandomString(12)}`; 
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        await db.query(
            'INSERT INTO keys (key_value, key_type, owner_discord_id, expires_at) VALUES ($1, $2, $3, $4)',
            [newKey, 'temp', discordId, expiresAt]
        );

        // 5. Réponse de succès
        return { statusCode: 200, body: 'SUCCESS' };

    } catch (error) {
        console.error('LootLabs Webhook DB Error for Discord ID', discordId, ':', error.message);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};
