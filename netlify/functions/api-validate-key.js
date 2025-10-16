// netlify/functions/api-validate-key.js
const db = require('./db');
const axios = require('axios');

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

exports.handler = async function (event, context) {
  try {
    let bodyData;
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      bodyData = { key: params.key, roblox_user_id: params.roblox_user_id, place_id: params.place_id };
    } else if (event.httpMethod === 'POST') {
      bodyData = JSON.parse(event.body);
    } else {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { key, roblox_user_id, place_id } = bodyData;
    if (!key || !roblox_user_id || !place_id) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Missing parameters.' }) };
    }

    const { rows } = await db.query('SELECT * FROM keys WHERE key_value = $1', [key]);
    if (rows.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Invalid Key.' }) };
    }
    const keyData = rows[0];

    // CORRECTION : Vérifie l'expiration pour les clés 'temp' ET 'trial'
    const isExpirable = keyData.key_type === 'temp' || keyData.key_type === 'trial';
    if (isExpirable && new Date(keyData.expires_at) < new Date()) {
      try {
        await db.query('DELETE FROM keys WHERE id = $1', [keyData.id]);
        console.log(`Expired key ${keyData.key_value} deleted from DB.`);
      } catch (deleteError) {
        console.error('Failed to delete expired key:', deleteError.message);
      }
      return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Key has expired.' }) };
    }

    if (keyData.roblox_user_id) {
      if (keyData.roblox_user_id !== roblox_user_id.toString()) {
        return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Please reset your HWID on the website.' }) };
      }
    } else {
      await db.query('UPDATE keys SET roblox_user_id = $1 WHERE key_value = $2', [roblox_user_id, keyData.key_value]);
    }

    const scriptUrl = gameScripts[place_id.toString()];
    if (!scriptUrl) {
      return { statusCode: 200, body: JSON.stringify({ success: false, message: 'This game is not supported.' }) };
    }

    const scriptContentResponse = await axios.get(scriptUrl);
    const scriptContent = scriptContentResponse.data;

    return { statusCode: 200, body: JSON.stringify({ success: true, script: scriptContent }) };
  } catch (error) {
    console.error('Validation Error (Critical):', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, message: 'An internal error occurred.' }) };
  }
};
