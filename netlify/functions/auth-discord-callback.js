// netlify/functions/auth-discord-callback.js
const axios = require('axios');
const cookie = require('cookie');
const jwt = require('jsonwebtoken');
const db = require('./db'); // Ensure this path is correct

const {
    DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET,
    REDIRECT_URI,
    JWT_SECRET,
    GUILD_ID // IMPORTANT: Add your Discord Server ID to your Netlify environment variables
} = process.env;

exports.handler = async function (event, context) {
    const { code } = event.queryStringParameters;
    if (!code) {
        return { statusCode: 400, body: 'Missing authorization code.' };
    }

    try {
        // Exchange code for an access token
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

        // Fetch user's Discord identity
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });
        const discordUser = userResponse.data;

        // --- NOUVELLE PARTIE : FETCH USER ROLES ---
        let userRoles = [];
        try {
            const guildMemberResponse = await axios.get(`https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`, {
                headers: { 'Authorization': `Bearer ${access_token}` }
            });
            userRoles = guildMemberResponse.data.roles || [];
        } catch (guildError) {
            // This error means the user is not in the server.
            if (guildError.response && guildError.response.status === 404) {
                 return {
                    statusCode: 403,
                    body: 'Access Denied: You must be a member of the Discord server.'
                };
            }
            console.error('Error fetching guild member info:', guildError.message);
            // If another error occurs, we can proceed without roles, but it's not ideal.
        }
        // --- FIN DE LA NOUVELLE PARTIE ---

        const { id, username, avatar } = discordUser;
        const avatarUrl = avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png` : null;

        // Upsert user in the database with their new roles
        await db.query(
            `INSERT INTO users (discord_id, discord_username, discord_avatar, last_login, roles)
             VALUES ($1, $2, $3, NOW(), $4)
             ON CONFLICT (discord_id)
             DO UPDATE SET
                discord_username = EXCLUDED.discord_username,
                discord_avatar = EXCLUDED.discord_avatar,
                last_login = NOW(),
                roles = EXCLUDED.roles;`, // Make sure to update roles on every login
            [id, username, avatarUrl, userRoles]
        );

        // Create JWT
        const token = jwt.sign({ discord_id: id }, JWT_SECRET, { expiresIn: '7d' });

        // Set JWT in a secure cookie
        const sessionCookie = cookie.serialize('session_token', token, {
            httpOnly: true,
            secure: true,
            path: '/',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7 // 7 days
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
