// netlify/functions/auth-discord.js
exports.handler = async function (event, context) {
    const scope = 'identify guilds.members.read';
    const discordLoginUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${process.env.URL}/auth/discord/callback&response_type=code&scope=${encodeURIComponent(scope)}`;

    return {
        statusCode: 302,
        headers: {
            Location: discordLoginUrl,
        },
    };
};
