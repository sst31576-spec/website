// netlify/functions/api-earn-time.js
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db');

// --- CONFIGURATION DU JEU ---
const MAX_REBIRTH_LEVEL = 10;
const MAX_UPGRADE_LEVEL = 50; // Niveau requis pour chaque item avant le rebirth

// Anti-Autoclick
const AUTOCLICK_CLICKS_TO_CHECK = 15;
const AUTOCLICK_TIME_THRESHOLD_MS = 2000; // 15 clics en 2s
const BLOCK_DURATION_HOURS = 1;

// Nouvelles améliorations
const KING_GAME_UPGRADES = {
    click: { name: 'Royal Scepter', baseCost: 15, costMultiplier: 1.15, value: 1 },
    b1: { name: 'Peasant Hut', baseCost: 100, costMultiplier: 1.1, cps: 1 },
    b2: { name: 'Farm', baseCost: 1100, costMultiplier: 1.12, cps: 8 },
    b3: { name: 'Castle', baseCost: 12000, costMultiplier: 1.14, cps: 45 },
    b4: { name: 'Kingdom', baseCost: 130000, costMultiplier: 1.16, cps: 250 },
    b5: { name: 'Empire', baseCost: 1500000, costMultiplier: 1.18, cps: 1400 },
    b6: { name: 'Galaxy', baseCost: 20000000, costMultiplier: 1.2, cps: 7800 },
    b7: { name: 'Universe', baseCost: 330000000, costMultiplier: 1.22, cps: 44000 },
};

// Boutique de Gems
const GEM_BOOSTS = {
    'x2_coins': { name: '2x Coin Boost', cost: 10, duration_minutes: 60 },
    'half_cost': { name: '50% Upgrade Discount', cost: 5, duration_minutes: 5 },
};

// --- AJOUT : COÛT POUR 1H DE TEMPS DE CLÉ ---
// (50 * (1+8+45+250+1400+7800+44000)) CPS * (8 * 3600) secondes
const BUY_TIME_COST = BigInt('77045760000'); // 77,045,760,000

// --- FONCTIONS HELPERS ---
const getUpgradeCost = (upgradeId, level, active_boosts) => {
    const upgrade = KING_GAME_UPGRADES[upgradeId];
    let cost = Math.ceil(upgrade.baseCost * Math.pow(upgrade.costMultiplier, level));
    
    if (active_boosts && active_boosts['half_cost'] && new Date(active_boosts['half_cost']) > new Date()) {
        cost = Math.ceil(cost / 2);
    }
    return cost;
};

const calculateKingGameState = (user) => {
    const upgrades = user.king_game_upgrades || {};
    const active_boosts = user.active_boosts || {};
    const getLevel = (id) => upgrades[id] || 0;

    const rebirth_bonus = 1 + (user.rebirth_level || 0) * 0.10;

    let clickValue = 1 + (getLevel('click') * KING_GAME_UPGRADES.click.value);
    let cps = 0;
    for (const id in KING_GAME_UPGRADES) {
        if (id !== 'click') {
            cps += getLevel(id) * KING_GAME_UPGRADES[id].cps;
        }
    }
    
    let finalClickValue = Math.round(clickValue * rebirth_bonus);
    let finalCps = Math.round(cps * rebirth_bonus);

    if (active_boosts['x2_coins'] && new Date(active_boosts['x2_coins']) > new Date()) {
        finalClickValue *= 2;
        finalCps *= 2;
    }
    
    return { clickValue: finalClickValue, cps: finalCps };
};

// --- HANDLER PRINCIPAL ---
exports.handler = async function (event, context) {
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

    // --- LOGIQUE GET ---
    if (event.httpMethod === 'GET') {
        const action = event.queryStringParameters.action;
        
        // Nouvelle action pour récupérer la liste des joueurs
        if (action === 'get_users') {
            try {
                const { rows } = await db.query('SELECT discord_id, discord_username FROM users ORDER BY discord_username');
                return { statusCode: 200, body: JSON.stringify(rows) };
            } catch (error) {
                 return { statusCode: 500, body: JSON.stringify({ error: 'Could not fetch user list.' }) };
            }
        }

        // Action par défaut pour vérifier l'accès au jeu
        try {
            const { rows } = await db.query('SELECT expires_at FROM keys WHERE owner_discord_id = $1 AND (key_type = \'perm\' OR (key_type = \'temp\' AND expires_at > NOW())) LIMIT 1', [id]);
            if (rows.length === 0) {
                return { statusCode: 404, body: JSON.stringify({ error: 'You do not have an active key to play with.' }) };
            }
            return { statusCode: 200, body: JSON.stringify({ expires_at: rows[0].expires_at }) };
        } catch (error) {
            return { statusCode: 500, body: JSON.stringify({ error: 'An internal server error occurred.' }) };
        }
    }

    // --- LOGIQUE POST ---
    if (event.httpMethod === 'POST') {
        const body = JSON.parse(event.body);
        const client = await db.getClient();

        try {
            await client.query('BEGIN');
            const { rows } = await client.query('SELECT *, king_game_coins::text FROM users WHERE discord_id = $1 FOR UPDATE', [id]);
            if (rows.length === 0) throw new Error('User not found.');
            
            let user = rows[0];
            const now = new Date();

            // Vérification anti-autoclick
            if (user.blocked_until && new Date(user.blocked_until) > now) {
                const remainingMinutes = Math.ceil((new Date(user.blocked_until) - now) / 60000);
                throw new Error(`Autoclick detected. You are blocked for ${remainingMinutes} more minutes.`);
            }

            // Calcul des gains AFK
            const lastUpdate = new Date(user.last_king_game_update);
            const secondsDiff = Math.floor((now - lastUpdate) / 1000);
            if (secondsDiff > 0) {
                const { cps } = calculateKingGameState(user);
                user.king_game_coins = (BigInt(user.king_game_coins) + BigInt(secondsDiff * cps)).toString();
            }

            const { action } = body;
            let upgrades = user.king_game_upgrades || {};
            let active_boosts = user.active_boosts || {};
            
            // --- AJOUT : Variable pour la réponse ---
            let responseData = {};

            // ACTIONS DU JEU
            if (action === 'click') {
                let timestamps = user.click_timestamps || [];
                timestamps.push(now.toISOString());
                timestamps = timestamps.slice(-AUTOCLICK_CLICKS_TO_CHECK);
                user.click_timestamps = timestamps;

                if (timestamps.length === AUTOCLICK_CLICKS_TO_CHECK) {
                    const firstClick = new Date(timestamps[0]);
                    if (now - firstClick < AUTOCLICK_TIME_THRESHOLD_MS) {
                        user.blocked_until = new Date(now.getTime() + BLOCK_DURATION_HOURS * 60 * 60 * 1000);
                        user.click_timestamps = []; // reset
                        throw new Error(`Autoclick detected! You are blocked for ${BLOCK_DURATION_HOURS} hour.`);
                    }
                }
                const { clickValue } = calculateKingGameState(user);
                user.king_game_coins = (BigInt(user.king_game_coins) + BigInt(clickValue)).toString();

            } else if (action === 'buy_upgrade') {
                const { upgradeId } = body;
                if (!KING_GAME_UPGRADES[upgradeId]) throw new Error('Invalid upgrade.');
                const level = upgrades[upgradeId] || 0;
                const cost = getUpgradeCost(upgradeId, level, active_boosts);

                if (BigInt(user.king_game_coins) >= BigInt(cost)) {
                    user.king_game_coins = (BigInt(user.king_game_coins) - BigInt(cost)).toString();
                    upgrades[upgradeId] = level + 1;
                } else {
                    throw new Error("Not enough coins.");
                }

            } else if (action === 'rebirth') {
                if (user.rebirth_level >= MAX_REBIRTH_LEVEL) throw new Error("You have reached the maximum rebirth level.");
                
                let canRebirth = true;
                for (const id in KING_GAME_UPGRADES) {
                    if ((upgrades[id] || 0) < MAX_UPGRADE_LEVEL) {
                        canRebirth = false;
                        break;
                    }
                }
                if (!canRebirth) throw new Error(`You must have all upgrades at level ${MAX_UPGRADE_LEVEL} to rebirth.`);

                const gemsEarned = (user.rebirth_level + 1) * 5;
                user.gems += gemsEarned;
                user.rebirth_level += 1;
                user.king_game_coins = '0';
                upgrades = {};
                active_boosts = {};

            } else if (action === 'buy_boost') {
                const { boostId } = body;
                const boost = GEM_BOOSTS[boostId];
                if (!boost) throw new Error('Invalid boost.');
                if (user.gems < boost.cost) throw new Error('Not enough gems.');

                if (active_boosts[boostId] && new Date(active_boosts[boostId]) > now) {
                    throw new Error('This boost is already active.');
                }
                
                user.gems -= boost.cost;
                active_boosts[boostId] = new Date(now.getTime() + boost.duration_minutes * 60 * 1000).toISOString();

            } else if (action === 'send_coins') {
                const { recipientId, amount } = body;
                const amountBigInt = BigInt(amount);
                if (!recipientId || amountBigInt <= 0) throw new Error("Invalid recipient or amount.");
                if (recipientId === id) throw new Error("You cannot send coins to yourself.");
                if (BigInt(user.king_game_coins) < amountBigInt) throw new Error("Not enough coins to send.");

                user.king_game_coins = (BigInt(user.king_game_coins) - amountBigInt).toString();
                await client.query("UPDATE users SET king_game_coins = king_game_coins::numeric + $1 WHERE discord_id = $2", [amount, recipientId]);
            
            // --- NOUVELLE ACTION : ACHETER DU TEMPS ---
            } else if (action === 'buy_time') {
                if (BigInt(user.king_game_coins) < BUY_TIME_COST) {
                    throw new Error("Not enough coins to buy time.");
                }
                
                // Trouver la clé temporaire active de l'utilisateur
                const { rows: keyRows } = await client.query(
                    'SELECT id, expires_at FROM keys WHERE owner_discord_id = $1 AND key_type = \'temp\' AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1',
                    [id]
                );
                
                if (keyRows.length === 0) {
                    throw new Error("You do not have an active temporary key to extend.");
                }
                
                // Soustraire le coût
                user.king_game_coins = (BigInt(user.king_game_coins) - BUY_TIME_COST).toString();
                
                // Ajouter 1 heure à la date d'expiration actuelle
                const currentExpiresAt = new Date(keyRows[0].expires_at);
                const newExpiresAt = new Date(currentExpiresAt.getTime() + 60 * 60 * 1000);
                
                // Mettre à jour la clé
                await client.query('UPDATE keys SET expires_at = $1 WHERE id = $2', [newExpiresAt, keyRows[0].id]);
                
                // Ajouter la nouvelle date d'expiration à la réponse
                responseData.newExpiresAt = newExpiresAt.toISOString();
            }
            // --- FIN DE LA NOUVELLE ACTION ---
            
            // SAUVEGARDE DANS LA DB
            await client.query(
                `UPDATE users SET 
                    king_game_coins = $1, king_game_upgrades = $2, last_king_game_update = $3, 
                    rebirth_level = $4, click_timestamps = $5, blocked_until = $6,
                    gems = $7, active_boosts = $8
                WHERE discord_id = $9`, 
                [user.king_game_coins, JSON.stringify(upgrades), now.toISOString(), 
                user.rebirth_level, user.click_timestamps, user.blocked_until,
                user.gems, JSON.stringify(active_boosts), id]
            );
            
            await client.query('COMMIT');

            // Nettoyer les boosts expirés pour la réponse au client
            const final_active_boosts = {};
            for(const boostId in active_boosts) {
                if(new Date(active_boosts[boostId]) > now) {
                    final_active_boosts[boostId] = active_boosts[boostId];
                }
            }

            // Construire la réponse finale
            const finalResponse = {
                coins: user.king_game_coins,
                upgrades: upgrades,
                rebirth_level: user.rebirth_level,
                gems: user.gems,
                active_boosts: final_active_boosts,
                ...responseData // Ajoute newExpiresAt si l'action était 'buy_time'
            };

            return {
                statusCode: 200,
                body: JSON.stringify(finalResponse)
            };

        } catch (error) {
            await client.query('ROLLBACK');
            return { statusCode: 500, body: JSON.stringify({ error: error.message || 'An internal server error occurred.' }) };
        } finally {
            client.release();
        }
    }

    return { statusCode: 405, body: 'Method Not Allowed' };
};
