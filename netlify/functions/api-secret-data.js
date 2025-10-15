// Le mot de passe secret que vous mettrez dans vos variables d'environnement
const SECRET_API_KEY = process.env.INTERNAL_API_KEY;

exports.handler = async function (event, context) {
    // On récupère le mot de passe envoyé par le script Roblox
    const providedApiKey = event.headers['x-api-key'];

    // On vérifie si le mot de passe est le bon
    if (providedApiKey !== SECRET_API_KEY) {
        // Si le mot de passe est manquant ou incorrect, on bloque l'accès.
        return { 
            statusCode: 403, // 403 Forbidden
            body: 'Access Denied.' 
        };
    }

    // Si le mot de passe est bon, on peut renvoyer les données
    const data = {
        message: "Voici les informations secrètes."
        // ... ici on mettrait les données que seul le script doit voir
    };
    
    return {
        statusCode: 200,
        body: JSON.stringify(data)
    };
};
