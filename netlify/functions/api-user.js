// netlify/functions/api-user.js
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db');
const axios = require('axios');

const PERM_ROLES = ['869611811962511451', '1426871180282822757', '869611883836104734', '877989445725483009', '869612027897839666', '1421439929052954674', '1426774369711165501', '1422640196020867113', '877904473983447101', '1428725197803884545'];
const ADMIN_ROLES = ['869611811962511451', '877989445725483009'];

exports.handler = async function (event, context) {
    const cookies = event.headers.cookie ? cookie.parse(event.headers.cookie) : {};
    const token = cookies.auth_token;
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { id } = decoded;

        const memberResponse = await axios.get(`https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/members/${id}`, { headers: { 'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}` } });
        const member = memberResponse.data;

        const hasAdminRole = member.roles.some(roleId => ADMIN_ROLES.includes(roleId));
        const hasPermRole = member.roles.some(roleId => PERM_ROLES.includes(roleId));
        const userStatus = hasPermRole ? 'Perm' : 'Free';

        const { rows } = await db.query('SELECT * FROM users WHERE discord_id = $1', [id]);
        if (rows.length === 0) return { statusCode: 404, body: JSON.stringify({ error: 'User not found in DB. Please re-log.' }) };
        
        let user = rows[0];
        if (user.user_status !== userStatus) {
            await db.query('UPDATE users SET user_status = $1 WHERE discord_id = $2', [userStatus, id]);
            user.user_status = userStatus;
        }

        const finalUserObject = { ...user, isAdmin: hasAdminRole };
        return { statusCode: 200, body: JSON.stringify(finalUserObject) };
    } catch (error) {
        if (error.response && error.response.status === 404) return { statusCode: 403, body: JSON.stringify({ error: 'You must join the Discord server.' }) };
        console.error('API User Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Internal error.' }) };
    }
};
