// netlify/functions/api-validate-key.js
const db = require('./db');
const axios = require('axios');

// ✅ Liste des jeux autorisés
const gameScripts = {
  '16656664443': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '15666650878': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '79243087103999': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '4543855070': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '76944637102068': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '12997619803': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '118396261129211': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/SADSADSAD",
  '110866861848433': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/22222222",
  '136993633183001': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/22222222",
  '94282122066477': "https://pastebin.com/raw/x8JTfbKZ",
  '18642553859': "https://pastebin.com/raw/99cDESLz",
  '18337464872': "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/3333333"
};

// --- NOUVELLES CONSTANTES ---
const TESTER_SCRIPT_URL = "https://raw.githubusercontent.com/sst31576-spec/ASDSDASSADSA/refs/heads/main/tester";
const TESTER_ROLE_IDS = [
    '1421439929052954674', // Tester
    '1428730376519553186', // K-Manager
    '869611811962511451'  // Owner
];
const TESTER_PREFIX = 'TESTER_';
// --- FIN DES NOUVELLES CONSTANTES ---


// ✅ Fonction principale
exports.handler = async function (event, context) {
  try {
    let bodyData;
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      bodyData = {
        key: params.key,
        roblox_user_id: params.roblox_user_id,
        place_id: params.place_id
      };
    } else if (event.httpMethod === 'POST') {
      bodyData = JSON.parse(event.body);
    } else {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    let { key, roblox_user_id, place_id } = bodyData;
    if (!key || !roblox_user_id || !place_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'Missing parameters.' })
      };
    }

    // --- NOUVELLE LOGIQUE: GESTION DU PRÉFIXE TESTEUR ---
    const isTesterMode = key.startsWith(TESTER_PREFIX);
    let actualKey = key;
    if (isTesterMode) {
        actualKey = key.substring(TESTER_PREFIX.length);
    }
    // --- FIN DE LA LOGIQUE DU PRÉFIXE ---

    // 🔎 Vérifie la clé (la vraie clé, sans le préfixe)
    const { rows: keyRows } = await db.query('SELECT * FROM keys WHERE key_value = $1', [actualKey]);
    if (keyRows.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Invalid Key.' }) };
    }
    const keyData = keyRows[0];

    // --- LOGIQUE SPÉCIFIQUE AU MODE TESTEUR ---
    if (isTesterMode) {
        if (!keyData.discord_id) {
            return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Tester mode requires a key linked to Discord.' }) };
        }

        const { rows: userRows } = await db.query('SELECT roles FROM users WHERE discord_id = $1', [keyData.discord_id]);
        if (userRows.length === 0) {
            return { statusCode: 200, body: JSON.stringify({ success: false, message: 'User not found for this key.' }) };
        }
        
        const userRoles = userRows[0].roles || [];
        const isAllowedTester = userRoles.some(roleId => TESTER_ROLE_IDS.includes(roleId));

        if (!isAllowedTester) {
            return { statusCode: 200, body: JSON.stringify({ success: false, message: 'You do not have permission to use tester mode.' }) };
        }
        
        const scriptContentResponse = await axios.get(TESTER_SCRIPT_URL);
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, script: scriptContentResponse.data })
        };
    }
    // --- FIN DE LA LOGIQUE TESTEUR ---

    // ⏳ Si ce n'est pas le mode testeur, on continue normalement
    if (keyData.key_type === 'temp' && new Date(keyData.expires_at) < new Date()) {
      try {
        await db.query('DELETE FROM keys WHERE id = $1', [keyData.id]);
      } catch (deleteError) {
        console.error('Failed to delete expired key:', deleteError.message);
      }
      return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Key has expired.' }) };
    }

    // 🧩 Vérifie HWID
    if (keyData.roblox_user_id) {
      if (keyData.roblox_user_id !== roblox_user_id.toString()) {
        return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Please reset your HWID on the website.' }) };
      }
    } else {
      await db.query('UPDATE keys SET roblox_user_id = $1 WHERE key_value = $2', [roblox_user_id, keyData.key_value]);
    }

    // 🎮 Vérifie le jeu
    const scriptUrl = gameScripts[place_id.toString()];
    if (!scriptUrl) {
      return { statusCode: 200, body: JSON.stringify({ success: false, message: 'This game is not supported.' }) };
    }

    // 📜 Télécharge le script distant
    const scriptContentResponse = await axios.get(scriptUrl);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, script: scriptContentResponse.data })
    };

  } catch (error) {
    console.error('Validation Error (Critical):', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: 'An internal error occurred.' })
    };
  }
};
