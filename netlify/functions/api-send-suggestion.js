// netlify/functions/api-send-suggestion.js
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');

const WEBHOOK_URL = process.env.SUGGESTION_WEBHOOK_URL;

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const cookies = event.headers.cookie ? cookie.parse(event.headers.cookie) : {};
    const token = cookies.auth_token;

    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { username } = decoded;
        const { suggestion } = JSON.parse(event.body);

        if (!suggestion || suggestion.trim() === '') {
            return { statusCode: 400, body: JSON.stringify({ error: 'Suggestion cannot be empty.' }) };
        }

        // Create a formatted embed for Discord
        const embed = {
            author: { name: `New Suggestion from ${username}` },
            description: suggestion,
            color: 16776960, // Yellow
            timestamp: new Date().toISOString()
        };

        await axios.post(WEBHOOK_URL, { embeds: [embed] });

        return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Suggestion sent!' }) };

    } catch (error) {
        console.error('Suggestion Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send suggestion.' }) };
    }
};
