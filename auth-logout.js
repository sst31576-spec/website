// netlify/functions/auth-logout.js
const cookie = require('cookie');

exports.handler = async function (event, context) {
    const expiredCookie = cookie.serialize('auth_token', '', {
        httpOnly: true,
        secure: true,
        path: '/',
        expires: new Date(0),
    });

    return {
        statusCode: 302,
        headers: { 'Set-Cookie': expiredCookie, 'Location': '/' },
    };
};
