// netlify/functions/auth-discord-callback.js
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db');

exports.handler = async function (event, context) {
    const { code } = event.queryStringParameters;
    if (!code) {
        return { statusCode: 302, headers: { 'Location': '/?error=No-code-provided' } };
    }

    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: process.env.URL + '/auth/discord/callback',
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const { access_token, refresh_token } = tokenResponse.data;

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { 'Authorization': `Bearer ${access_token}` },
        });

        const { id, username, avatar } = userResponse.data;
        const avatarURL = avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png` : null;

        const { rows } = await db.query('SELECT * FROM users WHERE discord_id = $1', [id]);
        if (rows.length > 0) {
            await db.query('UPDATE users SET discord_username = $1, discord_avatar = $2, access_token = $3, refresh_token = $4 WHERE discord_id = $5', [username, avatarURL, access_token, refresh_token, id]);
        } else {
            await db.query('INSERT INTO users (discord_id, discord_username, discord_avatar, access_token, refresh_token) VALUES ($1, $2, $3, $4, $5)', [id, username, avatarURL, access_token, refresh_token]);
        }

        const sessionToken = jwt.sign({ id, username }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const sessionCookie = cookie.serialize('auth_token', sessionToken, {
            httpOnly: true, secure: true, path: '/', maxAge: 60 * 60 * 24 * 7,
        });

        return {
            statusCode: 302,
            headers: { 'Set-Cookie': sessionCookie, 'Location': '/' },
        };
    } catch (error) {
        console.error('Authentication callback error:', error.response ? error.response.data : error.message);
        return { statusCode: 302, headers: { 'Location': '/?error=Authentication-failed' } };
    }
};
