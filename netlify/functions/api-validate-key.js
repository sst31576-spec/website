// netlify/functions/api-validate-key.js
const db = require('./db');
const axios = require('axios');

// ✅ Liste des jeux autorisés (Veuillez vous assurer que cette liste est correcte et complète)
const gameScripts = {
  '16656664443': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '15666650878': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '79243087103999': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '4543855070': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '76944637102068': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '12997619803': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '118396261129211': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
};

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { key, roblox_user_id, place_id } = JSON.parse(event.body);

        if (!key || !roblox_user_id || !place_id) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Missing parameters.' }) };
        }

        // 🔑 Récupère les données de la clé
        // Si cette requête échoue, elle sera capturée par le bloc catch principal
        const { rows } = await db.query('SELECT * FROM keys WHERE key_value = $1', [key]);
        if (rows.length === 0) {
            return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Invalid Key.' }) };
        }
        const keyData = rows[0];

        // ⏳ Vérifie l’expiration et effectue le nettoyage si la clé est temporaire
        if (keyData.key_type === 'temp' && keyData.expires_at) {
            
            // NOTE IMPORTANTE: Comparaison par l'objet Date directement
            const expirationDate = new Date(keyData.expires_at);
            const currentDate = new Date();

            if (expirationDate < currentDate) {
                // *** CORRECTION : SUPPRESSION DE LA CLÉ EXPIRÉE ***
                // La tentative de suppression est isolée.
                // Si la suppression échoue, nous continuons de bloquer la clé (Key has expired).
                try {
                    await db.query('DELETE FROM keys WHERE id = $1', [keyData.id]);
                    console.log(`Expired key ${keyData.key_value} deleted from DB.`);
                } catch (deleteError) {
                    // Nous n'affichons pas d'erreur au client (Roblox) car la clé est bien expirée.
                    console.error('Échec de la suppression de la clé expirée (Problème BDD):', deleteError.message);
                }
                // *** FIN DE CORRECTION ***
                
                return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Key has expired.' }) };
            }
        }

        // 🧩 Vérifie HWID
        if (keyData.roblox_user_id) {
            if (keyData.roblox_user_id !== roblox_user_id.toString()) {
                return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Please reset your HWID on the website.' }) };
            }
        } else {
            // Associe HWID à la première utilisation
            await db.query('UPDATE keys SET roblox_user_id = $1 WHERE key_value = $2', [roblox_user_id, keyData.key_value]);
        }

        // 🎮 Vérifie le jeu
        const scriptUrl = gameScripts[place_id.toString()];
        if (!scriptUrl) {
            return { statusCode: 200, body: JSON.stringify({ success: false, message: 'This game is not supported.' }) };
        }

        // 📜 Télécharge le script distant
        const scriptContentResponse = await axios.get(scriptUrl);
        const scriptContent = scriptContentResponse.data;

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, scriptContent: scriptContent })
        };

    } catch (error) {
        // Ce bloc est exécuté si la première requête BDD (SELECT) ou la requête Axios échoue.
        console.error('Validation FAILED (Erreur Critique):', error.message);
        // Renvoie un code 500 (Internal Server Error) si l'erreur est critique.
        // Cela correspond à l'erreur "Could not connect to server" côté client (Roblox).
        return { 
            statusCode: 500, 
            body: JSON.stringify({ 
                success: false, 
                message: 'Internal Server Error (Check Netlify logs).' 
            }) 
        };
    }
};
