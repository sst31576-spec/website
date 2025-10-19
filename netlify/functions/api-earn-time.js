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
        try {
            const { rows } = await db.query(
                'SELECT expires_at FROM keys WHERE owner_discord_id = $1 AND key_type = $2 AND expires_at > NOW()',
                [id, 'temp']
            );
            if (rows.length === 0) return { statusCode: 404, body: JSON.stringify({ error: 'You do not have an active temporary key to play with.' }) };
            return { statusCode: 200, body: JSON.stringify({ expires_at: rows[0].expires_at }) };
        } catch (error) {
            console.error('Earn Time GET Error:', error);
            return { statusCode: 500, body: JSON.stringify({ error: 'An internal server error occurred.' }) };
        }
    }

    // --- POST: Jouer à un jeu ---
    if (event.httpMethod === 'POST') {
        const body = JSON.parse(event.body);
        const { game } = body;

        // --- Logique du Coin Flip ---
        if (game === 'coinflip') {
            try {
                const { bet } = body;
                if (!bet) return { statusCode: 400, body: JSON.stringify({ error: 'Missing bet.' }) };
                
                const betInMs = parseDurationToMs(bet);
                if (betInMs <= 0 || betInMs > 2 * 3600 * 1000) return { statusCode: 400, body: JSON.stringify({ error: 'Invalid bet amount. Maximum is 2 hours.' }) };
                
                const { rows } = await db.query('SELECT id, expires_at, coinflip_streak FROM keys WHERE owner_discord_id = $1 AND key_type = $2 AND expires_at > NOW()', [id, 'temp']);
                if (rows.length === 0) return { statusCode: 404, body: JSON.stringify({ error: 'No active temporary key found.' }) };

                const key = rows[0];
                if (betInMs > (new Date(key.expires_at).getTime() - Date.now())) return { statusCode: 400, body: JSON.stringify({ error: 'You cannot bet more time than you have.' }) };
                
                const difficultyMultiplier = Math.pow(1.5, key.coinflip_streak);
                const winChance = Math.max(0.1, 0.5 / difficultyMultiplier);
                const win = Math.random() < winChance;
                
                const currentExpiresTime = new Date(key.expires_at).getTime();
                const newExpiresAt = win ? new Date(currentExpiresTime + betInMs) : new Date(Math.max(Date.now(), currentExpiresTime - betInMs));
                const newStreak = win ? key.coinflip_streak + 1 : 0;

                await db.query('UPDATE keys SET expires_at = $1, coinflip_streak = $2 WHERE id = $3', [newExpiresAt, newStreak, key.id]);
                return { statusCode: 200, body: JSON.stringify({ win, new_expires_at: newExpiresAt.toISOString(), new_streak: newStreak }) };
            } catch (error) {
                console.error('Coinflip POST Error:', error);
                return { statusCode: 500, body: JSON.stringify({ error: 'An internal error occurred while playing.' }) };
            }
        }
        
        // --- Logique du Blackjack ---
        if (game === 'blackjack') {
            const { action, bet } = body;
            const client = await db.getClient();
            try {
                await client.query('BEGIN');
                const { rows } = await client.query('SELECT id, expires_at, blackjack_streak, blackjack_game_state FROM keys WHERE owner_discord_id = $1 AND key_type = $2 AND expires_at > NOW() FOR UPDATE', [id, 'temp']);
                if (rows.length === 0) throw new Error('No active temporary key found.');
                const key = rows[0];

                let gameState = key.blackjack_game_state ? JSON.parse(key.blackjack_game_state) : {};
                
                // Action: Démarrer une partie
                if (action === 'deal') {
                    const betInMs = parseDurationToMs(bet);
                    if (betInMs <= 0 || betInMs > 2 * 3600 * 1000) throw new Error('Invalid bet amount. Maximum is 2 hours.');
                    if (betInMs > (new Date(key.expires_at).getTime() - Date.now())) throw new Error('You cannot bet more time than you have.');
                    
                    const deck = shuffleDeck(createDeck());
                    const playerHand = [deck.pop(), deck.pop()];
                    const dealerHand = [deck.pop(), deck.pop()];
                    
                    gameState = { deck, playerHand, dealerHand, bet: betInMs, gameOver: false, message: '' };

                    const playerValue = calculateHandValue(playerHand);
                    const dealerValue = calculateHandValue(dealerHand);

                    if (playerValue === 21 && dealerValue === 21) {
                        gameState.gameOver = true;
                        gameState.message = "Push! Both have Blackjack.";
                        await client.query('UPDATE keys SET blackjack_game_state = NULL WHERE id = $1', [key.id]);
                    } else if (playerValue === 21) {
                        gameState.gameOver = true;
                        gameState.message = "Blackjack! You win!";
                        const newExpiresAt = new Date(new Date(key.expires_at).getTime() + gameState.bet * 1.5); // Blackjack pays 3:2
                        const newStreak = key.blackjack_streak + 1;
                        await client.query('UPDATE keys SET expires_at = $1, blackjack_streak = $2, blackjack_game_state = NULL WHERE id = $3', [newExpiresAt, newStreak, key.id]);
                    } else {
                        await client.query('UPDATE keys SET blackjack_game_state = $1 WHERE id = $2', [JSON.stringify(gameState), key.id]);
                    }
                } 
                // Actions: Tirer une carte ou Rester
                else if (action === 'hit' || action === 'stand') {
                    if (!gameState.deck) throw new Error('No game in progress.');

                    if (action === 'hit') {
                        gameState.playerHand.push(gameState.deck.pop());
                        if (calculateHandValue(gameState.playerHand) > 21) {
                            gameState.gameOver = true;
                            gameState.message = "Bust! You lose.";
                            const newExpiresAt = new Date(Math.max(Date.now(), new Date(key.expires_at).getTime() - gameState.bet));
                            await client.query('UPDATE keys SET expires_at = $1, blackjack_streak = 0, blackjack_game_state = NULL WHERE id = $2', [newExpiresAt, key.id]);
                        } else {
                           await client.query('UPDATE keys SET blackjack_game_state = $1 WHERE id = $2', [JSON.stringify(gameState), key.id]);
                        }
                    } else { // action === 'stand'
                        gameState.gameOver = true;
                        let dealerValue = calculateHandValue(gameState.dealerHand);
                        while(dealerValue < 17) {
                            gameState.dealerHand.push(gameState.deck.pop());
                            dealerValue = calculateHandValue(gameState.dealerHand);
                        }

                        const playerValue = calculateHandValue(gameState.playerHand);
                        let newExpiresAt, newStreak;

                        if (dealerValue > 21 || playerValue > dealerValue) {
                            gameState.message = "You win!";
                            newExpiresAt = new Date(new Date(key.expires_at).getTime() + gameState.bet);
                            newStreak = key.blackjack_streak + 1;
                        } else if (playerValue < dealerValue) {
                            gameState.message = "Dealer wins.";
                            newExpiresAt = new Date(Math.max(Date.now(), new Date(key.expires_at).getTime() - gameState.bet));
                            newStreak = 0;
                        } else {
                            gameState.message = "Push.";
                            newExpiresAt = key.expires_at; // No change
                            newStreak = key.blackjack_streak; // No change
                        }
                         await client.query('UPDATE keys SET expires_at = $1, blackjack_streak = $2, blackjack_game_state = NULL WHERE id = $3', [newExpiresAt, newStreak, key.id]);
                    }
                }
                await client.query('COMMIT');
                return { statusCode: 200, body: JSON.stringify({ gameState }) };
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Blackjack POST Error:', error);
                return { statusCode: 500, body: JSON.stringify({ error: error.message || 'An internal server error occurred while playing.' }) };
            } finally {
                client.release();
            }
        }
        
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid game specified.' }) };
    }
    
    return { statusCode: 405, body: 'Method Not Allowed' };
};
