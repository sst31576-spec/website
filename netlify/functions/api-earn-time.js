// netlify/functions/api-earn-time.js
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db');

// --- GAME CONFIGURATION ---
const MAX_REBIRTH_LEVEL = 10;
const MAX_UPGRADE_LEVEL = 50;
const MAX_TROOP_LEVEL = 5;
const CONVERT_TIME_COST = 100000000000; // 100 Billion

// Anti-Autoclick
const AUTOCLICK_CLICKS_TO_CHECK = 15;
const AUTOCLICK_TIME_THRESHOLD_MS = 2000;
const BLOCK_DURATION_HOURS = 1;

// Economic Upgrades (27 total)
const KING_GAME_UPGRADES = {
    click: { name: 'Royal Scepter', baseCost: 15, costMultiplier: 1.15, value: 1 },
    b1: { name: 'Peasant Hut', baseCost: 100, costMultiplier: 1.1, cps: 1 },
    b2: { name: 'Farm', baseCost: 1100, costMultiplier: 1.12, cps: 8 },
    b3: { name: 'Castle', baseCost: 12000, costMultiplier: 1.14, cps: 45 },
    b4: { name: 'Kingdom', baseCost: 130000, costMultiplier: 1.16, cps: 250 },
    b5: { name: 'Empire', baseCost: 1.5e6, costMultiplier: 1.20, cps: 1400 },
    b6: { name: 'Galaxy', baseCost: 20e6, costMultiplier: 1.25, cps: 7800 },
    b7: { name: 'Universe', baseCost: 330e6, costMultiplier: 1.30, cps: 44000 },
    c1: { name: 'Marketplace', baseCost: 5e9, costMultiplier: 1.28, cps: 260000 },
    c2: { name: 'Bank', baseCost: 7.5e10, costMultiplier: 1.27, cps: 1.6e6 },
    c3: { name: 'Library', baseCost: 1e12, costMultiplier: 1.26, cps: 9.5e6 },
    c4: { name: 'University', baseCost: 1.4e13, costMultiplier: 1.25, cps: 5.8e7 },
    c5: { name: 'Observatory', baseCost: 2e14, costMultiplier: 1.24, cps: 3.5e8 },
    c6: { name: 'Space Elevator', baseCost: 3e15, costMultiplier: 1.23, cps: 2.1e9 },
    c7: { name: 'Moon Base', baseCost: 4.5e16, costMultiplier: 1.22, cps: 1.3e10 },
    c8: { name: 'Mars Colony', baseCost: 6.5e17, costMultiplier: 1.21, cps: 8e10 },
    d1: { name: 'Asteroid Mine', baseCost: 9e18, costMultiplier: 1.20, cps: 5e11 },
    d2: { name: 'Gas Giant Harvester', baseCost: 1.2e20, costMultiplier: 1.19, cps: 3.2e12 },
    d3: { name: 'Interstellar Shipyard', baseCost: 1.6e21, costMultiplier: 1.18, cps: 2e13 },
    d4: { name: 'Dyson Swarm', baseCost: 2.2e22, costMultiplier: 1.17, cps: 1.3e14 },
    d5: { name: 'Matrioshka Brain', baseCost: 3e23, costMultiplier: 1.16, cps: 8.5e14 },
    d6: { name: 'Stellar Engine', baseCost: 4e24, costMultiplier: 1.15, cps: 5.6e15 },
    d7: { name: 'Black Hole Generator', baseCost: 5.5e25, costMultiplier: 1.14, cps: 3.8e16 },
    d8: { name: 'Pocket Dimension', baseCost: 7.5e26, costMultiplier: 1.13, cps: 2.6e17 },
    e1: { name: 'Reality Fabricator', baseCost: 1e28, costMultiplier: 1.12, cps: 1.8e18 },
    e2: { name: 'Time Machine', baseCost: 1.5e29, costMultiplier: 1.11, cps: 1.2e19 },
    e3: { name: 'Omniverse Portal', baseCost: 2.5e30, costMultiplier: 1.10, cps: 8e19 },
};

// Military Units
const TROOPS = {
    squire: { name: 'Squire', cost: 10000, power: 50, training_time_seconds: 60, upgrade_cost_multiplier: 1 },
    swordsman: { name: 'Swordsman', cost: 50000, power: 250, training_time_seconds: 180, upgrade_cost_multiplier: 1.2 },
    spearman: { name: 'Spearman', cost: 75000, power: 375, training_time_seconds: 240, upgrade_cost_multiplier: 1.3 },
    archer: { name: 'Archer', cost: 100000, power: 500, training_time_seconds: 300, upgrade_cost_multiplier: 1.4 },
    cavalry: { name: 'Cavalry', cost: 250000, power: 1250, training_time_seconds: 600, upgrade_cost_multiplier: 2 },
    knight: { name: 'Knight', cost: 1e6, power: 5000, training_time_seconds: 1800, upgrade_cost_multiplier: 3 },
    royal_guard: { name: 'Royal Guard', cost: 5e6, power: 25000, training_time_seconds: 3600, perm_only: true, upgrade_cost_multiplier: 5 },
};

const SPY_DEFENSE_UPGRADE = { baseCost: 1e6, costMultiplier: 3 };
const SPY_COST = 1e5;

// Gem Shop
const GEM_BOOSTS = {
    'x2_coins': { name: '2x Coin Boost', cost: 10, duration_minutes: 60 },
    'half_cost': { name: '50% Upgrade Discount', cost: 5, duration_minutes: 5 },
};

// --- HELPER FUNCTIONS ---

const getTroopStat = (troopType, level) => {
    const basePower = TROOPS[troopType].power;
    const powerMultiplier = Math.pow(1.2, level);
    return Math.floor(basePower * powerMultiplier);
};

const getTroopUpgradeCost = (troopType, level) => {
    const troop = TROOPS[troopType];
    const baseCost = troop.cost * 5; // Upgrading costs 5x the unit's base cost
    return BigInt(Math.floor(baseCost * Math.pow(3, level) * troop.upgrade_cost_multiplier));
};

const calculateArmyPower = (army, troopLevels) => {
    let totalPower = BigInt(0);
    for (const troopType in army) {
        if (TROOPS[troopType]) {
            const level = troopLevels[troopType] || 0;
            const powerPerUnit = getTroopStat(troopType, level);
            totalPower += BigInt(army[troopType]) * BigInt(powerPerUnit);
        }
    }
    return totalPower.toString();
};

const simulateBattle = (attacker, defender) => {
    // This is a complex function representing the battle outcome.
    // It calculates effective power based on unit counters.
    
    const calculateEffectivePower = (primary, secondary) => {
        let totalEffectivePower = 0;
        for (const troop in primary.army) {
            if (primary.army[troop] > 0) {
                const level = primary.troopLevels[troop] || 0;
                const basePower = getTroopStat(troop, level);
                let damageMultiplier = 1.0;

                if (troop === 'cavalry') {
                    damageMultiplier += 0.35 * (secondary.army.archer || 0) / (secondary.totalTroops + 1);
                    damageMultiplier += 0.60 * (secondary.army.swordsman || 0) / (secondary.totalTroops + 1);
                    damageMultiplier -= 2.00 * (secondary.army.spearman || 0) / (secondary.totalTroops + 1);
                } else if (troop === 'spearman') {
                    damageMultiplier -= 0.50 * (secondary.army.archer || 0) / (secondary.totalTroops + 1);
                    damageMultiplier += 4.00 * (secondary.army.cavalry || 0) / (secondary.totalTroops + 1);
                } else if (troop === 'squire') damageMultiplier += 0.5;
                else if (troop === 'knight') damageMultiplier += 1.0;
                else if (troop === 'royal_guard') damageMultiplier += 2.0;

                totalEffectivePower += primary.army[troop] * basePower * Math.max(0.1, damageMultiplier);
            }
        }
        return totalEffectivePower;
    };
    
    attacker.totalTroops = Object.values(attacker.army).reduce((a, b) => a + b, 0);
    defender.totalTroops = Object.values(defender.army).reduce((a, b) => a + b, 0);

    let attackerPower = calculateEffectivePower(attacker, defender);
    let defenderPower = calculateEffectivePower(defender, attacker);

    if (attacker.title === 'King') attackerPower *= 4;
    if (attacker.title === 'General') attackerPower *= 2.5;

    const winner = attackerPower > defenderPower ? attacker.id : defender.id;
    const attackerLossRate = winner === attacker.id ? 0.2 : 0.6; // Higher stakes
    const defenderLossRate = winner === attacker.id ? 0.5 : 0.2;

    const finalAttackerArmy = {}, attackerLosses = {};
    const finalDefenderArmy = {}, defenderLosses = {};

    for(const troop in attacker.army) {
        const losses = Math.ceil(attacker.army[troop] * attackerLossRate);
        finalAttackerArmy[troop] = attacker.army[troop] - losses;
        attackerLosses[troop] = losses;
    }
    for(const troop in defender.army) {
        const losses = Math.ceil(defender.army[troop] * defenderLossRate);
        finalDefenderArmy[troop] = defender.army[troop] - losses;
        defenderLosses[troop] = losses;
    }

    return { winner_id: winner, attackerLosses, defenderLosses, finalAttackerArmy, finalDefenderArmy };
};

const updateTitles = async (client) => {
    // This function runs periodically or after major battles to assign titles
    await client.query(`UPDATE users SET title = NULL`);
    const { rows: topPlayers } = await client.query(`SELECT discord_id FROM users ORDER BY power DESC, discord_username ASC LIMIT 3`);
    if (topPlayers.length > 0) await client.query(`UPDATE users SET title = 'King' WHERE discord_id = $1`, [topPlayers[0].discord_id]);
    if (topPlayers.length > 1) await client.query(`UPDATE users SET title = 'Queen' WHERE discord_id = $1`, [topPlayers[1].discord_id]);
    if (topPlayers.length > 2) await client.query(`UPDATE users SET title = 'General' WHERE discord_id = $1`, [topPlayers[2].discord_id]);
};


// --- MAIN HANDLER ---
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
    const { id: userId } = decoded;

    // --- GET LOGIC (LOAD GAME STATE) ---
    if (event.httpMethod === 'GET') {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            // Process any finished training queue
            const { rows: queue } = await client.query('SELECT * FROM training_queue WHERE user_id = $1', [userId]);
            if (queue.length > 0 && new Date(queue[0].finish_time) <= new Date()) {
                await client.query(`UPDATE armies SET ${queue[0].troop_type} = ${queue[0].troop_type} + $1 WHERE user_id = $2`, [queue[0].quantity, userId]);
                await client.query('DELETE FROM training_queue WHERE user_id = $1', [userId]);
            }

            const { rows: users } = await client.query('SELECT *, king_game_coins::text, power::text FROM users WHERE discord_id = $1', [userId]);
            if (users.length === 0) throw new Error('User not found.');
            
            let user = users[0];
             // AFK coin calculation
            const lastUpdate = new Date(user.last_king_game_update);
            const secondsDiff = Math.floor((new Date() - lastUpdate) / 1000);
            if (secondsDiff > 0) {
                 const { cps } = calculateKingGameState(user); // simplified call
                user.king_game_coins = (BigInt(user.king_game_coins) + BigInt(secondsDiff * cps)).toString();
                await client.query('UPDATE users SET king_game_coins = $1, last_king_game_update = NOW() WHERE discord_id = $2', [user.king_game_coins, userId]);
            }

            // Fetch all game-related data
            const { rows: armies } = await client.query('SELECT * FROM armies WHERE user_id = $1', [userId]);
            const { rows: training } = await client.query('SELECT * FROM training_queue WHERE user_id = $1', [userId]);
            const { rows: reports } = await client.query('SELECT * FROM battle_reports WHERE owner_id = $1 ORDER BY report_time DESC LIMIT 10', [userId]);
            const { rows: leaderboard } = await client.query('SELECT discord_username, power::text, title FROM users WHERE power > 0 ORDER BY power DESC LIMIT 10');

            await client.query('COMMIT');

            // Construct full game state to return to client
            return { statusCode: 200, body: JSON.stringify({ 
                user, 
                army: armies[0] || {}, 
                trainingQueue: training[0] || null, 
                battleReports: reports,
                leaderboard
            }) };
        } catch(e) {
            await client.query('ROLLBACK');
            return { statusCode: 500, body: JSON.stringify({ error: `Failed to load game state: ${e.message}` }) };
        } finally {
            client.release();
        }
    }

    // --- POST LOGIC (PLAYER ACTIONS) ---
    if (event.httpMethod === 'POST') {
        const body = JSON.parse(event.body);
        const { action } = body;
        const client = await db.getClient();

        try {
            await client.query('BEGIN');
            // Lock the user's row to prevent race conditions
            const { rows } = await client.query('SELECT *, king_game_coins::text, power::text FROM users WHERE discord_id = $1 FOR UPDATE', [userId]);
            if (rows.length === 0) throw new Error('User not found.');
            
            let user = rows[0];
            const now = new Date();

            // Check if blocked
            if (user.blocked_until && new Date(user.blocked_until) > now) {
                const remainingMinutes = Math.ceil((new Date(user.blocked_until) - now) / 60000);
                throw new Error(`Autoclick detected. You are blocked for ${remainingMinutes} more minutes.`);
            }

            // Update coins from AFK gains before processing action
            const lastUpdate = new Date(user.last_king_game_update);
            const secondsDiff = Math.floor((now - lastUpdate) / 1000);
            if (secondsDiff > 0) {
                const { cps } = calculateKingGameState(user); // simplified call
                user.king_game_coins = (BigInt(user.king_game_coins) + BigInt(secondsDiff * cps)).toString();
            }

            // ACTION HANDLER
            switch (action) {
                case 'click': {
                    // ... (autoclick logic from previous version)
                    const { clickValue } = calculateKingGameState(user);
                    user.king_game_coins = (BigInt(user.king_game_coins) + BigInt(clickValue)).toString();
                    break;
                }
                case 'buy_upgrade': {
                    // ... (logic from previous version)
                    break;
                }
                case 'rebirth': {
                    // ... (logic from previous version)
                    user.gems += (user.rebirth_level + 1) * 5;
                    // Reset army and levels on rebirth
                    await client.query(`UPDATE armies SET swordsman=0, spearman=0, archer=0, cavalry=0, squire=0, knight=0, royal_guard=0, troop_levels='{}' WHERE user_id = $1`, [userId]);
                    break;
                }
                case 'buy_boost': {
                    // ... (logic from previous version)
                    break;
                }
                 case 'send_coins': {
                    // ... (logic from previous version)
                    break;
                }
                case 'train_troops': {
                    const { troopType, quantity } = body;
                    if (!TROOPS[troopType] || !Number.isInteger(quantity) || quantity <= 0) throw new Error("Invalid training request.");
                    if (TROOPS[troopType].perm_only && user.user_status !== 'Perm') throw new Error("This unit is for Perm users only.");
                    
                    const { rows: queue } = await client.query('SELECT * FROM training_queue WHERE user_id = $1', [userId]);
                    if (queue.length > 0) throw new Error("A training is already in progress.");

                    const totalCost = BigInt(TROOPS[troopType].cost) * BigInt(quantity);
                    if (BigInt(user.king_game_coins) < totalCost) throw new Error("Not enough coins.");
                    user.king_game_coins = (BigInt(user.king_game_coins) - totalCost).toString();

                    const totalTime = TROOPS[troopType].training_time_seconds * quantity;
                    const finishTime = new Date(now.getTime() + totalTime * 1000);

                    await client.query('INSERT INTO training_queue (user_id, troop_type, quantity, finish_time) VALUES ($1, $2, $3, $4)', [userId, troopType, quantity, finishTime]);
                    break;
                }
                case 'upgrade_troop': {
                    const { troopType } = body;
                    if (!TROOPS[troopType]) throw new Error("Invalid troop type.");
                    
                    const { rows: armies } = await client.query('SELECT troop_levels FROM armies WHERE user_id = $1', [userId]);
                    const troopLevels = armies[0].troop_levels || {};
                    const currentLevel = troopLevels[troopType] || 0;

                    if (currentLevel >= MAX_TROOP_LEVEL) throw new Error("Troop is already at max level.");
                    
                    const cost = getTroopUpgradeCost(troopType, currentLevel);
                    if (BigInt(user.king_game_coins) < cost) throw new Error("Not enough coins for troop upgrade.");
                    user.king_game_coins = (BigInt(user.king_game_coins) - cost).toString();

                    troopLevels[troopType] = currentLevel + 1;
                    await client.query('UPDATE armies SET troop_levels = $1 WHERE user_id = $2', [troopLevels, userId]);
                    break;
                }
                case 'attack': {
                    const { targetId } = body;
                    if (!targetId || targetId === userId) throw new Error("Invalid target.");
                    
                    // Fetch attacker and defender data
                    const { rows: targetUsers } = await client.query('SELECT * FROM users WHERE discord_id = $1', [targetId]);
                    if (targetUsers.length === 0) throw new Error("Target not found.");
                    const targetUser = targetUsers[0];

                    if (targetUser.title === 'King' || targetUser.title === 'Queen') throw new Error("You cannot attack the King or Queen.");

                    // ... (Battle simulation logic from helpers)
                    // This part would fetch army data for both, call simulateBattle, update armies and power for both users, and create reports.
                    
                    await updateTitles(client); // Recalculate titles after a battle
                    break;
                }
                // ... other actions like 'spy', 'upgrade_spy_defense' would go here
                default:
                    throw new Error("Invalid action.");
            }

            // Final save of user state
            await client.query(
                `UPDATE users SET 
                    king_game_coins = $1, king_game_upgrades = $2, last_king_game_update = $3, 
                    rebirth_level = $4, click_timestamps = $5, blocked_until = $6,
                    gems = $7, active_boosts = $8, power = (SELECT calculate_power_for_user($9))
                WHERE discord_id = $9`, 
                [user.king_game_coins, JSON.stringify(user.king_game_upgrades), now.toISOString(), 
                user.rebirth_level, user.click_timestamps, user.blocked_until,
                user.gems, JSON.stringify(user.active_boosts), userId]
            );

            await client.query('COMMIT');
            
            // Re-fetch final state to return to client
            const { rows: finalUsers } = await client.query('SELECT *, king_game_coins::text, power::text FROM users WHERE discord_id = $1', [userId]);

            return { statusCode: 200, body: JSON.stringify(finalUsers[0]) };

        } catch (error) {
            await client.query('ROLLBACK');
            return { statusCode: 500, body: JSON.stringify({ error: error.message || 'An internal server error occurred.' }) };
        } finally {
            client.release();
        }
    }

    return { statusCode: 405, body: 'Method Not Allowed' };
};

