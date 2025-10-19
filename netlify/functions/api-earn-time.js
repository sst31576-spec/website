// netlify/functions/api-earn-time.js
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db');

// NOUVEAU : Constantes pour la configuration du jeu
const MAX_UPGRADE_LEVEL = 50; // Niveau requis pour toutes les améliorations avant de pouvoir rebirth
const AUTOCLICK_CLICKS_TO_CHECK = 10; // Nombre de clics à analyser pour la détection
const AUTOCLICK_TIME_THRESHOLD_MS = 1500; // 10 clics en moins de 1.5 secondes = autoclick
const BLOCK_DURATION_HOURS = 1; // Durée du blocage en heures

// --- Helpers de Durée ---
const parseDurationToMs = (durationStr) => {
    const value = parseInt(durationStr.slice(0, -1));
    const unit = durationStr.slice(-1);
    if (unit === 'm') return value * 60 * 1000;
    if (unit === 'h') return value * 3600 * 1000;
    return 0;
};

// --- Logique du King Game (Clicker) ---
const KING_GAME_UPGRADES = {
    click: { name: 'Royal Scepter', baseCost: 15, costMultiplier: 1.15, value: 1 },
    b1: { name: 'Peasant Hut', baseCost: 100, costMultiplier: 1.1, cps: 1 },
    b2: { name: 'Farm', baseCost: 1100, costMultiplier: 1.12, cps: 8 },
    b3: { name: 'Castle', baseCost: 12000, costMultiplier: 1.14, cps: 45 },
    b4: { name: 'Kingdom', baseCost: 130000, costMultiplier: 1.16, cps: 250 },
};

const getUpgradeCost = (upgradeId, level) => {
    const upgrade = KING_GAME_UPGRADES[upgradeId];
    return Math.ceil(upgrade.baseCost * Math.pow(upgrade.costMultiplier, level));
};

const calculateKingGameState = (user) => {
    const upgrades = user.king_game_upgrades || {};
    const getLevel = (id) => upgrades[id] || 0;

    // MODIFIÉ : Calcul du bonus de Rebirth
    const rebirth_bonus = 1 + (user.rebirth_level || 0) * 0.10;

    let clickValue = 1 + (getLevel('click') * KING_GAME_UPGRADES.click.value);
    let cps = 0;
    for (const id in KING_GAME_UPGRADES) {
        if (id !== 'click') {
            cps += getLevel(id) * KING_GAME_UPGRADES[id].cps;
        }
    }
    
    // MODIFIÉ : Application du bonus
    return { 
        clickValue: Math.round(clickValue * rebirth_bonus), 
        cps: Math.round(cps * rebirth_bonus),
    };
};

exports.handler = async function (event, context) {
    // Authentification
    const cookies = event.headers?.cookie ? cookie.parse(event.headers.cookie) : {};
    const token = cookies.auth_token;
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
    }
    const { id } = decoded;

    // GET: Récupérer les infos du joueur
    if (event.httpMethod === 'GET') {
        try {
            const { rows } = await db.query(
                'SELECT expires_at FROM keys WHERE owner_discord_id = $1 AND (key_type = \'perm\' OR (key_type = \'temp\' AND expires_at > NOW())) LIMIT 1',
                [id]
            );
            if (rows.length === 0) {
                return { statusCode: 404, body: JSON.stringify({ error: 'You do not have an active key to play with.' }) };
            }
            return { statusCode: 200, body: JSON.stringify({ expires_at: rows[0].expires_at }) };
        } catch (error) {
            console.error('Earn Time GET Error:', error);
            return { statusCode: 500, body: JSON.stringify({ error: 'An internal server error occurred.' }) };
        }
    }

    // POST: Jouer à un jeu
    if (event.httpMethod === 'POST') {
        const body = JSON.parse(event.body);
        const { game } = body;
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            if (game === 'coinflip' || game === 'blackjack') {
                await client.query('ROLLBACK');
                return { statusCode: 400, body: JSON.stringify({ error: 'Ce jeu n\'est pas encore implémenté.' }) };
            }
            
            if (game === 'king_game') {
                // MODIFIÉ : On récupère les nouvelles colonnes de la DB
                const { rows } = await client.query('SELECT *, king_game_coins::text FROM users WHERE discord_id = $1 FOR UPDATE', [id]);
                if (rows.length === 0) throw new Error('User not found.');
                let user = rows[0];

                // NOUVEAU : Vérification de l'anti-autoclick
                if (user.blocked_until && new Date(user.blocked_until) > new Date()) {
                    const remainingMinutes = Math.ceil((new Date(user.blocked_until) - new Date()) / 60000);
                    throw new Error(`Autoclick détecté. Vous êtes bloqué pour encore ${remainingMinutes} minutes.`);
                }

                const { action } = body;
                let upgrades = user.king_game_upgrades || {};
                const now = new Date();

                // Calcul gains AFK
                const lastUpdate = new Date(user.last_king_game_update);
                const secondsDiff = Math.floor((now - lastUpdate) / 1000);
                const { cps } = calculateKingGameState(user);
                if (secondsDiff > 0) {
                    user.king_game_coins = (BigInt(user.king_game_coins) + BigInt(secondsDiff * cps)).toString();
                }

                if (action === 'load') {
                    // Les gains AFK sont déjà calculés
                } else if (action === 'click') {
                    // NOUVEAU : Logique de détection d'autoclick
                    let clickTimestamps = user.click_timestamps || [];
                    clickTimestamps.push(now.toISOString());
                    clickTimestamps = clickTimestamps.slice(-AUTOCLICK_CLICKS_TO_CHECK);
                    user.click_timestamps = clickTimestamps;

                    if (clickTimestamps.length === AUTOCLICK_CLICKS_TO_CHECK) {
                        const firstClickTime = new Date(clickTimestamps[0]);
                        const lastClickTime = new Date(clickTimestamps[clickTimestamps.length - 1]);
                        if (lastClickTime - firstClickTime < AUTOCLICK_TIME_THRESHOLD_MS) {
                            user.blocked_until = new Date(now.getTime() + BLOCK_DURATION_HOURS * 60 * 60 * 1000);
                            await client.query('UPDATE users SET blocked_until = $1, click_timestamps = $2 WHERE discord_id = $3', [user.blocked_until, [], id]);
                            await client.query('COMMIT');
                            throw new Error(`Autoclick détecté ! Vous êtes bloqué pour ${BLOCK_DURATION_HOURS} heure.`);
                        }
                    }

                    const { clickValue } = calculateKingGameState(user);
                    user.king_game_coins = (BigInt(user.king_game_coins) + BigInt(clickValue)).toString();

                } else if (action === 'buy_upgrade') {
                    // ... (logique inchangée)
                } else if (action === 'convert_time') {
                    // ... (logique inchangée)
                } else if (action === 'send_coins') {
                    // ... (logique inchangée)
                } else if (action === 'rebirth') {
                    // NOUVEAU : Logique de Rebirth
                    let canRebirth = true;
                    for (const upgradeId in KING_GAME_UPGRADES) {
                        if ((upgrades[upgradeId] || 0) < MAX_UPGRADE_LEVEL) {
                            canRebirth = false;
                            break;
                        }
                    }
                    if (!canRebirth) {
                        throw new Error(`Vous devez avoir toutes les améliorations au niveau ${MAX_UPGRADE_LEVEL} pour faire un rebirth.`);
                    }

                    user.rebirth_level += 1;
                    user.king_game_coins = '0';
                    upgrades = {}; // Réinitialise les améliorations
                }

                // MODIFIÉ : Sauvegarde les nouvelles données dans la DB
                await client.query(
                    'UPDATE users SET king_game_coins = $1, king_game_upgrades = $2, last_king_game_update = $3, rebirth_level = $4, click_timestamps = $5, blocked_until = $6 WHERE discord_id = $7', 
                    [user.king_game_coins, JSON.stringify(upgrades), now.toISOString(), user.rebirth_level, user.click_timestamps, user.blocked_until, id]
                );
                
                await client.query('COMMIT');

                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        coins: user.king_game_coins,
                        upgrades: upgrades,
                        rebirth_level: user.rebirth_level,
                        is_blocked: user.blocked_until && new Date(user.blocked_until) > now
                    })
                };
            }
            else {
                await client.query('ROLLBACK');
                return { statusCode: 400, body: JSON.stringify({ error: 'Invalid game specified.' }) };
            }
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`${game} POST Error:`, error);
            return { statusCode: 500, body: JSON.stringify({ error: error.message || 'An internal server error occurred while playing.' }) };
        } finally {
            client.release();
        }
    }

    return { statusCode: 405, body: 'Method Not Allowed' };
};
