// netlify/functions/api-validate-key.js
const db = require('./db');
const axios = require('axios');

// ✅ Liste des jeux autorisés. La clé est le PlaceId de Roblox, la valeur est l'URL brute du script.
const gameScripts = {
  '16656664443': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '15666650878': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '79243087103999': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '4543855070': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '76944637102068': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '12997619803': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '118396261129211': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '9200384877': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '14420847101': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD"
};

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { key, roblox_user_id, place_id } = JSON.parse(event.body);

  if (!key || !roblox_user_id || !place_id) {
    return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Missing key, roblox_user_id, or place_id.' }) };
  }

  // 🔍 Cherche la clé
  const { rows } = await db.query('SELECT * FROM keys WHERE key_value = $1', [key]);

  if (rows.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Invalid key.' }) };
  }

  const keyData = rows[0];

  // ⏱️ Vérifie l'expiration pour les clés temporaires
  if (keyData.key_type === 'temp' && keyData.expires_at) {
    const expiresAt = new Date(keyData.expires_at);
    if (expiresAt < new Date()) {
      // Clé expirée
      
      // Suppression de la clé expirée de la base de données
      try {
        await db.query('DELETE FROM keys WHERE key_value = $1', [key]);
        console.log(`Expired temporary key ${key} deleted from DB.`);
      } catch (deleteError) {
        // En cas d'échec de la connexion à la BDD pour le DELETE, on log l'erreur mais on ne bloque pas le client.
        console.error('Failed to delete expired key:', deleteError.message);
      }
      // *** FIN DE L'AJOUT ***

      return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Key has expired.' }) };
    }
  }

  // 🧩 Vérifie HWID (roblox_user_id)
  if (keyData.roblox_user_id) {
    if (keyData.roblox_user_id !== roblox_user_id.toString()) {
      return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Please reset your HWID on the website.' }) };
    }
  } else {
    // Liaison de l'HWID à la clé. Conversion explicite en string pour la BDD.
    await db.query('UPDATE keys SET roblox_user_id = $1 WHERE key_value = $2', [roblox_user_id.toString(), keyData.key_value]);
  }

  // 🎮 Vérifie le jeu
  const scriptUrl = gameScripts[place_id.toString()];
  if (!scriptUrl) {
    return { statusCode: 200, body: JSON.stringify({ success: false, message: 'This game is not supported.' }) };
  }

  // 📜 Télécharge le script distant (Ajout d'un try/catch pour la robustesse)
  try {
    const scriptContentResponse = await axios.get(scriptUrl);
    const scriptContent = scriptContentResponse.data;

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, script: scriptContent })
    };
  } catch (axiosError) {
    // Erreur lors du téléchargement du script (404, 500, erreur réseau)
    console.error('Failed to fetch script from URL:', scriptUrl, axiosError.message);
    return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Script source is temporarily unavailable.' }) };
  }
};
