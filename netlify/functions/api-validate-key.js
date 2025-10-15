// netlify/functions/api-validate-key.js
const db = require('./db');
const axios = require('axios');

// This table now contains all the valid Place IDs from your keyhub.txt script
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

if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters;
    event.body = JSON.stringify({
        key: params.key,
        roblox_user_id: params.roblox_user_id,
        place_id: params.place_id
    });
} else if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
}


    try {
        const { key, roblox_user_id, place_id } = JSON.parse(event.body);
        if (!key || !roblox_user_id || !place_id) {
            return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Missing parameters.' }) };
        }

        const { rows } = await db.query('SELECT * FROM keys WHERE key_value = $1', [key]);
        if (rows.length === 0) {
            return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Invalid Key.' }) };
        }
        const keyData = rows[0];

        // Check if the key is expired (for 'temp' keys only)
        if (keyData.key_type === 'temp' && new Date(keyData.expires_at) < new Date()) {
            return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Key has expired.' }) };
        }

        // Check HWID
        if (keyData.roblox_user_id) {
            // If HWID is set, check if it matches
            if (keyData.roblox_user_id !== roblox_user_id.toString()) {
                return { statusCode: 200, body: JSON.stringify({ success: false, message: 'Please reset your HWID on the website.' }) };
            }
        } else {
            // If HWID is not set, link it now
            await db.query('UPDATE keys SET roblox_user_id = $1 WHERE key_value = $2', [roblox_user_id, keyData.key_value]);
        }

        // Check if the game is supported
        const scriptUrl = gameScripts[place_id.toString()];
        if (!scriptUrl) {
            return { statusCode: 200, body: JSON.stringify({ success: false, message: 'This game is not supported.' }) };
        }

        // Fetch the script content
        const scriptContentResponse = await axios.get(scriptUrl);
        const scriptContent = scriptContentResponse.data;

        // Success!
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, script: scriptContent })
        };
    } catch (error) {
        console.error('Validation Error:', error);
        return { statusCode: 500, body: JSON.stringify({ success: false, message: 'An internal error occurred.' }) };
    }
};
