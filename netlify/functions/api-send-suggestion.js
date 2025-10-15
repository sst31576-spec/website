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
        const { suggestion, gameName, gameLink } = JSON.parse(event.body); // Destructure new fields

        // MODIFIED Validation Check
        if (!suggestion || suggestion.trim() === '' || !gameName || gameName.trim() === '' || !gameLink || gameLink.trim() === '') {
            return { statusCode: 400, body: JSON.stringify({ error: 'Suggestion must include a Game Name, Game Link, and a detailed Suggestion.' }) };
        }

        // Create a formatted embed for Discord (MODIFIED to use Game Name and Link)
        const embed = {
            // Use Game Name as the title, and Game Link as the URL to make it clickable
            title: `[${gameName}] - New Suggestion`,
            url: gameLink,
            author: { name: `Suggested by: ${username}` },
            description: `**Suggestion Details:**\n${suggestion}`,
            fields: [
                { name: 'Roblox Game Link', value: gameLink, inline: false },
            ],
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
