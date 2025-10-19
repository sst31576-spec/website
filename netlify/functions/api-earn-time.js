// netlify/functions/api-earn-time.js
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db');

// --- Helpers de Durée ---
const parseDurationToMs = (durationStr) => {
    if (!durationStr) return 0;
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
    const upgrades = user.king_game_upgrades ? JSON.parse(user.king_game_upgrades) : {};
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
    // --- Authentification ---
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

    // --- GET: Récupérer les infos du joueur ---
    if (event.httpMethod === 'GET') {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const { rows } = await client.query('SELECT id, key_type, expires_at, playable_time_ms, last_daily_bonus FROM keys WHERE owner_discord_id = $1 AND (key_type = \'perm\' OR (key_type = \'temp\' AND expires_at > NOW())) FOR UPDATE', [id]);
            if (rows.length === 0) throw new Error('You do not have an active key to play with.');
            
            let key = rows[0];

            if (key.key_type === 'perm') {
                const now = new Date();
                const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
                
                if (!key.last_daily_bonus || new Date(key.last_daily_bonus) < oneDayAgo) {
                    const oneHourInMs = 3600 * 1000;
                    key.playable_time_ms = (BigInt(key.playable_time_ms) + BigInt(oneHourInMs)).toString();
                    await client.query('UPDATE keys SET playable_time_ms = $1, last_daily_bonus = $2 WHERE id = $3', [key.playable_time_ms, now, key.id]);
                }
            }
            
            await client.query('COMMIT');
            return { statusCode: 200, body: JSON.stringify(key) };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Earn Time GET Error:', error);
            return { statusCode: 500, body: JSON.stringify({ error: error.message || 'An internal server error occurred.' }) };
        } finally {
            client.release();
        }
    }

    // --- POST: Actions de jeu ---
    if (event.httpMethod === 'POST') {
        const body = JSON.parse(event.body);
        const { action, game } = body;
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // NOUVELLE ACTION : RECHERCHER DES UTILISATEURS
            if (action === 'search_users') {
                const { query } = body;
                if (!query) return { statusCode: 400, body: JSON.stringify([]) };
                const { rows } = await client.query(
                    `SELECT u.discord_username FROM users u JOIN keys k ON u.discord_id = k.owner_discord_id 
                     WHERE u.discord_username ILIKE $1 AND k.key_type = 'temp' AND u.discord_id != $2 LIMIT 5`,
                    [`%${query}%`, id]
                );
                await client.query('COMMIT');
                return { statusCode: 200, body: JSON.stringify(rows.map(r => r.discord_username)) };
            }

            // NOUVELLE ACTION : ENVOYER DU TEMPS
            if (action === 'send_time') {
                const { recipientName, duration } = body;
                const durationMs = parseDurationToMs(duration);

                if (!recipientName || durationMs <= 0) throw new Error('Invalid recipient or amount.');

                const { rows: senderRows } = await client.query("SELECT id, playable_time_ms FROM keys WHERE owner_discord_id = $1 AND key_type = 'perm' FOR UPDATE", [id]);
                if (senderRows.length === 0) throw new Error("Only 'Perm' users can send time.");
                
                const senderKey = senderRows[0];
                if (BigInt(senderKey.playable_time_ms) < BigInt(durationMs)) throw new Error("You don't have enough playable time to send.");

                const { rows: recipientUserRows } = await client.query("SELECT discord_id FROM users WHERE discord_username = $1", [recipientName]);
                if (recipientUserRows.length === 0) throw new Error("Recipient user not found.");
                
                const { rows: recipientKeyRows } = await client.query("SELECT id, expires_at FROM keys WHERE owner_discord_id = $1 AND key_type = 'temp' AND expires_at > NOW()", [recipientUserRows[0].discord_id]);
                if (recipientKeyRows.length === 0) throw new Error("Recipient does not have an active temporary key.");

                const newSenderBalance = BigInt(senderKey.playable_time_ms) - BigInt(durationMs);
                const newRecipientExpiry = new Date(new Date(recipientKeyRows[0].expires_at).getTime() + durationMs);

                await client.query('UPDATE keys SET playable_time_ms = $1 WHERE id = $2', [newSenderBalance.toString(), senderKey.id]);
                await client.query('UPDATE keys SET expires_at = $1 WHERE id = $2', [newRecipientExpiry, recipientKeyRows[0].id]);
                await client.query('UPDATE users SET total_time_earned = total_time_earned + $1 WHERE discord_id = $2', [durationMs, recipientUserRows[0].discord_id]);

                await client.query('COMMIT');
                return { statusCode: 200, body: JSON.stringify({ success: true, newPlayableTime: newSenderBalance.toString(), message: `Successfully sent ${duration} to ${recipientName}.` }) };
            }

            // MISE À JOUR DE LA LOGIQUE DES JEUX
            const { rows } = await client.query('SELECT id, key_type, expires_at, playable_time_ms, coinflip_streak, blackjack_streak, blackjack_game_state FROM keys WHERE owner_discord_id = $1 AND (key_type = \'perm\' OR (key_type = \'temp\' AND expires_at > NOW())) FOR UPDATE', [id]);
            if (rows.length === 0) throw new Error('No active key found to play with.');
            const key = rows[0];
            const isPerm = key.key_type === 'perm';

            // Logique du Coin Flip (Mise à jour)
            if (game === 'coinflip') {
                const { bet } = body;
                const betInMs = parseDurationToMs(bet);

                if (isPerm) {
                    if (BigInt(key.playable_time_ms) < betInMs) throw new Error('Not enough playable time.');
                } else {
                    if ((new Date(key.expires_at).getTime() - Date.now()) < betInMs) throw new Error('You cannot bet more time than you have.');
                }
                
                const win = Math.random() < 0.5 / Math.pow(1.5, key.coinflip_streak);
                const newStreak = win ? key.coinflip_streak + 1 : 0;
                
                if (isPerm) {
                    const newBalance = BigInt(key.playable_time_ms) + BigInt(win ? betInMs : -betInMs);
                    await client.query('UPDATE keys SET playable_time_ms = $1, coinflip_streak = $2 WHERE id = $3', [newBalance.toString(), newStreak, key.id]);
                } else {
                    const currentExpiresTime = new Date(key.expires_at).getTime();
                    const newExpiresAt = new Date(currentExpiresTime + (win ? betInMs : -betInMs));
                    if(newExpiresAt < Date.now()) newExpiresAt = new Date(); // Empêche le temps négatif
                    await client.query('UPDATE keys SET expires_at = $1, coinflip_streak = $2 WHERE id = $3', [newExpiresAt, newStreak, key.id]);
                    await client.query('UPDATE users SET total_time_earned = total_time_earned + $1 WHERE discord_id = $2', [win ? betInMs : 0, id]);
                }

                await client.query('COMMIT');
                return { statusCode: 200, body: JSON.stringify({ win, new_streak: newStreak }) };
            }

            // ... (logique pour Blackjack et King Game avec la même adaptation pour 'perm' vs 'temp')
            
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`Earn Time POST Error:`, error);
            return { statusCode: 500, body: JSON.stringify({ error: error.message || 'An internal server error occurred.' }) };
        } finally {
            client.release();
        }
    }
    
    return { statusCode: 405, body: 'Method Not Allowed' };
};
