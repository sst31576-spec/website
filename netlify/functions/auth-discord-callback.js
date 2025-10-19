// netlify/functions/auth-discord-callback.js
const axios = require('axios');
const cookie = require('cookie');
const jwt = require('jsonwebtoken');
const db = require('./db'); // Assurez-vous que ce chemin est correct

const {
    DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET,
    REDIRECT_URI,
    JWT_SECRET
} = process.env;

exports.handler = async function (event, context) {
    const { code } = event.queryStringParameters;
    if (!code) {
        return { statusCode: 400, body: 'Missing authorization code.' };
    }

    try {
        // Échange le code contre un jeton d'accès
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const { access_token } = tokenResponse.data;

        // Récupère l'identité de l'utilisateur Discord
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });
        const discordUser = userResponse.data;

        const { id, username, avatar } = discordUser;
        const avatarUrl = avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png` : null;

        // Met à jour ou insère l'utilisateur dans la base de données SANS les rôles
        await db.query(
            `INSERT INTO users (discord_id, discord_username, discord_avatar, last_login)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (discord_id)
             DO UPDATE SET
                discord_username = EXCLUDED.discord_username,
                discord_avatar = EXCLUDED.discord_avatar,
                last_login = NOW();`,
            [id, username, avatarUrl]
        );

        // Crée le JWT
        const token = jwt.sign({ discord_id: id }, JWT_SECRET, { expiresIn: '7d' });

        // Définit le JWT dans un cookie sécurisé
        const sessionCookie = cookie.serialize('session_token', token, {
            httpOnly: true,
            secure: true,
            path: '/',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7 // 7 jours
        });

        return {
            statusCode: 302,
            headers: {
                'Set-Cookie': sessionCookie,
                'Location': '/'
            }
        };
    } catch (error) {
        console.error('Auth Callback Error:', error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            body: 'An internal error occurred during authentication.'
        };
    }
};
