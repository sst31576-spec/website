// netlify/functions/api-earn-time.js
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db');

// --- Helpers de Durée ---
const parseDurationToMs = (durationStr) => {
    const value = parseInt(durationStr.slice(0, -1));
    const unit = durationStr.slice(-1);
    if (unit === 'm') return value * 60 * 1000;
    if (unit === 'h') return value * 3600 * 1000;
    return 0;
};

// --- Logique du jeu de Blackjack ---
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const createDeck = () => SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank })));
const shuffleDeck = (deck) => {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
};
const getCardValue = (card) => {
    if (['J', 'Q', 'K'].includes(card.rank)) return 10;
    if (card.rank === 'A') return 11;
    return parseInt(card.rank);
};
const calculateHandValue = (hand) => {
    let value = hand.reduce((sum, card) => sum + getCardValue(card), 0);
    let aces = hand.filter(card => card.rank === 'A').length;
    while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
    }
    return value;
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
    // CORRIGÉ : On n'utilise plus JSON.parse ici
    const upgrades = user.king_game_upgrades || {};
    const getLevel = (id) => upgrades[id] || 0;

    let clickValue = 1 + (getLevel('click') * KING_GAME_UPGRADES.click.value);
    let cps = 0;
    for (const id in KING_GAME_UPGRADES) {
        if (id !== 'click') {
            cps += getLevel(id) * KING_GAME_UPGRADES[id].cps;
        }
    }
    return { clickValue, cps };
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
            // CORRIGÉ : On vérifie si l'utilisateur a une clé 'perm' OU une clé 'temp' active
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

            // Logique du Coin Flip
            if (game === 'coinflip') {
                //
                // ATTENTION : TU DOIS REMETTRE LE CODE DU JEU COINFLIP ICI
                //
                await client.query('COMMIT'); // N'oublie pas le commit à la fin de la logique
                // et de retourner une réponse 200
            }
            // Logique du Blackjack
            else if (game === 'blackjack') {
                //
                // ATTENTION : TU DOIS REMETTRE LE CODE DU JEU BLACKJACK ICI
                //
                await client.query('COMMIT'); // N'oublie pas le commit à la fin de la logique
                // et de retourner une réponse 200
            }
            // Logique du King Game
            else if (game === 'king_game') {
                const { action } = body;
                const { rows } = await client.query('SELECT king_game_coins, king_game_upgrades, last_king_game_update FROM users WHERE discord_id = $1 FOR UPDATE', [id]);
                if (rows.length === 0) throw new Error('User not found.');
                
                let user = rows[0];
                // CORRIGÉ : On n'utilise plus JSON.parse ici
                let upgrades = user.king_game_upgrades || {};

                // Calcul gains AFK
                const now = new Date();
                const lastUpdate = new Date(user.last_king_game_update);
                const secondsDiff = Math.floor((now - lastUpdate) / 1000);
                const { cps } = calculateKingGameState(user);
                if (secondsDiff > 0) {
                    user.king_game_coins = (BigInt(user.king_game_coins) + BigInt(secondsDiff * cps)).toString();
                }

                if (action === 'load') {
                    // Les gains AFK sont déjà calculés
                } else if (action === 'click') {
                    const { clickValue } = calculateKingGameState(user);
                    user.king_game_coins = (BigInt(user.king_game_coins) + BigInt(clickValue)).toString();
                } else if (action === 'buy_upgrade') {
                    const { upgradeId } = body;
                    if (!KING_GAME_UPGRADES[upgradeId]) throw new Error('Invalid upgrade.');
                    
                    const currentLevel = upgrades[upgradeId] || 0;
                    const cost = getUpgradeCost(upgradeId, currentLevel);

                    if (BigInt(user.king_game_coins) >= BigInt(cost)) {
                        user.king_game_coins = (BigInt(user.king_game_coins) - BigInt(cost)).toString();
                        upgrades[upgradeId] = currentLevel + 1;
                    } else {
                        throw new Error("Not enough coins.");
                    }
                } else if (action === 'convert_time') {
                    const cost = 1000000;
                    if (BigInt(user.king_game_coins) >= BigInt(cost)) {
                        user.king_game_coins = (BigInt(user.king_game_coins) - BigInt(cost)).toString();
                        const { rows: keyRows } = await client.query('SELECT id, expires_at FROM keys WHERE owner_discord_id = $1 AND key_type = $2 AND expires_at > NOW()', [id, 'temp']);
                        if (keyRows.length === 0) throw new Error("No active key to add time to.");
                        const key = keyRows[0];
                        const newExpiresAt = new Date(new Date(key.expires_at).getTime() + 3600 * 1000); // Ajoute 1h
                        await client.query('UPDATE keys SET expires_at = $1 WHERE id = $2', [newExpiresAt, key.id]);
                    } else {
                        throw new Error("You need 1,000,000 coins to convert.");
                    }
                } else if (action === 'send_coins') {
                    const { recipientName, amount } = body;
                    const amountBigInt = BigInt(amount);
                    if (amountBigInt <= 0) throw new Error("Invalid amount.");
                    if (BigInt(user.king_game_coins) < amountBigInt) throw new Error("Not enough coins to send.");
                    
                    const { rows: recipientRows } = await client.query("SELECT discord_id FROM users WHERE discord_username ILIKE $1", [recipientName]);
                    if(recipientRows.length === 0) throw new Error("Recipient not found.");
                    const recipientId = recipientRows[0].discord_id;
                    if(recipientId === id) throw new Error("You cannot send coins to yourself.");

                    user.king_game_coins = (BigInt(user.king_game_coins) - amountBigInt).toString();
                    await client.query("UPDATE users SET king_game_coins = king_game_coins + $1 WHERE discord_id = $2", [amount, recipientId]);
                }

                await client.query('UPDATE users SET king_game_coins = $1, king_game_upgrades = $2, last_king_game_update = $3 WHERE discord_id = $4', [user.king_game_coins, JSON.stringify(upgrades), now.toISOString(), id]);
                await client.query('COMMIT');

                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        coins: user.king_game_coins,
                        upgrades: upgrades
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
