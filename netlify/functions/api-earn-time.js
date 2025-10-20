// netlify/functions/api-earn-time.js
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db');

// --- GAME CONFIGURATION ---
const PRESTIGE_REQUIREMENT_LEVEL = 75; const MAX_PRESTIGE_LEVEL = 20;
const TROOPS_CONFIG = { 'warrior': { name: 'Warrior', cost: 10000, power: 10, costMultiplier: 1.05 }, 'archer': { name: 'Archer', cost: 50000, power: 45, costMultiplier: 1.06 }, 'knight': { name: 'Knight', cost: 250000, power: 220, costMultiplier: 1.07 }, 'mage': { name: 'Mage', cost: 1200000, power: 1100, costMultiplier: 1.08 }, 'dragon': { name: 'Dragon', cost: 8000000, power: 6500, costMultiplier: 1.1 },};
const SPECIAL_UNITS_CONFIG = { 'elite_soldier': { name: 'Elite Soldier', cost: 5000000, power: 3000, costMultiplier: 1.12 }, 'queens_guard': { name: 'Queen\'s Guard', cost: 25000000, power: 12000, costMultiplier: 1.15 }, 'royal_guard': { name: 'Royal Guard', cost: 100000000, power: 50000, costMultiplier: 1.2 },};
const ALL_TROOPS_CONFIG = { ...TROOPS_CONFIG, ...SPECIAL_UNITS_CONFIG };
const DEFENSES_CONFIG = { 'wall': { name: 'Wooden Wall', cost: 15000, power: 15, costMultiplier: 1.05 }, 'tower': { name: 'Watchtower', cost: 70000, power: 60, costMultiplier: 1.06 }, 'fortress': { name: 'Fortress', cost: 350000, power: 280, costMultiplier: 1.07 }, 'cannon': { name: 'Cannon', cost: 1800000, power: 1500, costMultiplier: 1.08 }, 'magic_shield': { name: 'Magic Shield', cost: 10000000, power: 8000, costMultiplier: 1.1 },};
const RANKS_CONFIG = []; const rankTiers = ['Bronze', 'Iron', 'Steel', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Emerald', 'Ruby', 'Sapphire', 'Amethyst', 'Topaz', 'Jade', 'Opal', 'Onyx', 'Quartz', 'Titanium', 'Obsidian', 'Mythril', 'Adamantite']; const subRanks = ['V', 'IV', 'III', 'II', 'I']; let powerThreshold = 1000; let rankIndex = 0; RANKS_CONFIG.push({ power: 0, name: 'Unranked', index: rankIndex }); rankIndex++; for (const tier of rankTiers) { for (const sub of subRanks) { RANKS_CONFIG.push({ power: powerThreshold, name: `${tier} ${sub}`, index: rankIndex }); powerThreshold = Math.floor(powerThreshold * 1.4); rankIndex++; } powerThreshold = Math.floor(powerThreshold * 1.2); }
const KING_GAME_UPGRADES = { click: { name: 'Royal Scepter', baseCost: 15, costMultiplier: 1.15, value: 1 }, b1: { name: 'Peasant Hut', baseCost: 100, costMultiplier: 1.1, cps: 1 }, b2: { name: 'Farm', baseCost: 1100, costMultiplier: 1.12, cps: 8 }, b3: { name: 'Bakery', baseCost: 8500, costMultiplier: 1.13, cps: 35 }, b4: { name: 'Blacksmith', baseCost: 40000, costMultiplier: 1.13, cps: 150 }, b5: { name: 'Market', baseCost: 210000, costMultiplier: 1.14, cps: 720 }, b6: { name: 'Inn', baseCost: 1.4e6, costMultiplier: 1.15, cps: 3800 }, b7: { name: 'Guard Tower', cost: 9e6, costMultiplier: 1.15, cps: 21000 }, b8: { name: 'Church', cost: 5.5e7, costMultiplier: 1.16, cps: 115000 }, b9: { name: 'Library', cost: 3.8e8, costMultiplier: 1.16, cps: 650000 }, b10: { name: 'Town Hall', cost: 2.5e9, costMultiplier: 1.17, cps: 3.4e6 }, b11: { name: 'Castle', cost: 1.8e10, costMultiplier: 1.18, cps: 2e7 }, b12: { name: 'Barracks', cost: 1.2e11, costMultiplier: 1.18, cps: 1.1e8 }, b13: { name: 'University', cost: 8e11, costMultiplier: 1.19, cps: 6e8 }, b14: { name: 'Cathedral', cost: 5.2e12, costMultiplier: 1.19, cps: 3.5e9 }, b15: { name: 'Royal Palace', cost: 3.6e13, costMultiplier: 1.2, cps: 2.2e10 }, b16: { name: 'Kingdom', cost: 2.8e14, costMultiplier: 1.21, cps: 1.5e11 }, b17: { name: 'Empire', cost: 2.1e15, costMultiplier: 1.21, cps: 9e11 }, b18: { name: 'Senate', cost: 1.5e16, costMultiplier: 1.22, cps: 5.5e12 }, b19: { name: 'Colosseum', cost: 1.1e17, costMultiplier: 1.22, cps: 3e13 }, b20: { name: 'Grand Temple', cost: 8e17, costMultiplier: 1.23, cps: 1.8e14 },};
const highTierNames = [ 'Quantum Forge', 'Nebula Reactor', 'Stargate Hub', 'Galactic Exchange', 'Celestial Spire', 'Ethereal Nexus', 'Singularity Core', 'Hyperspace Beacon', 'Chrono-Synth Factory', 'Void Matter Extractor', 'Cosmic Oracle', 'Stellar Shipyard', 'Dimension Weaver', 'Reality Engine', 'Genesis Chamber', 'Omega Citadel', 'Astro-Observatory', 'Dark Matter Plant', 'Supernova Catalyst', 'Infinity Gate', 'Celestial Forge', 'Stardust Silo', 'Event Horizon Lab', 'Galaxy Brain Nexus', 'Time Dilation Spire', 'Reality Bender', 'The Omniverse', 'Finality Point', 'The Great Attractor', 'The Void' ];
let lastCps = BigInt('180000000000000'); let lastCost = BigInt('800000000000000000');
for (let i = 21; i <= 50; i++) { const cpsMultiplier = BigInt(Math.round((5 + i * 0.1) * 10)); const costMultiplier = BigInt(Math.round((6 + i * 0.15) * 100)); lastCps = (lastCps * cpsMultiplier) / 10n; lastCost = (lastCost * costMultiplier) / 100n; const name = highTierNames[i - 21] || `Cosmic Entity #${i - 20}`; KING_GAME_UPGRADES[`b${i}`] = { name: name, baseCost: lastCost, costMultiplier: 1.23 + (i * 0.002), cps: lastCps };}
const GEM_BOOSTS = { 'x2_coins': { name: '2x Coin Boost', cost: 10, duration_minutes: 60 }, 'half_cost': { name: '50% Upgrade Discount', cost: 5, duration_minutes: 5 },};
const BASE_COST_PER_HOUR = 1000000000n; // 1 Billion

const LEADER_BONUSES = {
    power: { King: { attack_power_multiplier: 2.0 }, Queen: { defense_power_multiplier: 2.0 }, General: { attack_power_multiplier: 1.5, defense_power_multiplier: 1.5 } },
    coins: { King: { coin_multiplier: 2.0 }, Queen: { steal_multiplier: 1.5 }, General: { cost_reducer: 0.9 } }, // 10% cost reduction
    prestige: { General: { coin_multiplier: 1.25 } }
};
const LEADER_REWARDS = { // Daily time rewards in hours
    power: { King: 3, Queen: 2, General: 1 },
    coins: { King: 2, Queen: 1, General: 0.5 },
    prestige: { King: 2, Queen: 1, General: 0.5 }
};

const getCost = (baseCost, costMultiplier, level, userRoles) => {
    let cost = baseCost;
    let effectiveMultiplier = costMultiplier;
    let finalCost = BigInt(Math.ceil(Number(baseCost) * Math.pow(effectiveMultiplier, level)));

    if (userRoles.coins === 'General') {
        finalCost = finalCost * 90n / 100n; // Apply 10% reduction
    }
    return finalCost;
};
const getUpgradeCost = (upgradeId, level, active_boosts, userRoles) => { const config = KING_GAME_UPGRADES[upgradeId]; let cost = getCost(BigInt(config.baseCost), config.costMultiplier, level, userRoles); if (active_boosts && active_boosts.half_cost && new Date(active_boosts.half_cost) > new Date()) { cost /= 2n; } return cost; };
const getUnitCost = (unitId, level, isTroop, userRoles) => { const config = isTroop ? ALL_TROOPS_CONFIG[unitId] : DEFENSES_CONFIG[unitId]; return getCost(BigInt(config.cost), config.costMultiplier, level, userRoles); };

const calculatePower = u => { let c = 0; const a = u.troops || {}, r = u.defenses || {}; for (const t in a) { if(ALL_TROOPS_CONFIG[t]) c += (a[t].level || 1) * ALL_TROOPS_CONFIG[t].power * (a[t].quantity || 0) }; for (const t in r) { if(DEFENSES_CONFIG[t]) c += (r[t].level || 1) * DEFENSES_CONFIG[t].power * (r[t].quantity || 0) }; return BigInt(c) };
const calculateKingGameState = async (user, tops) => {
    const upgrades = user.king_game_upgrades || {}; const active_boosts = user.active_boosts || {};
    const getLevel = (id) => upgrades[id] || 0;

    const userRoles = {};
    for (const category in tops) {
        const rankIndex = tops[category].indexOf(user.discord_id);
        if (rankIndex !== -1) {
            const role = rankIndex === 0 ? "King" : rankIndex === 1 ? "Queen" : "General";
            userRoles[category] = role;
        }
    }
    
    let clickValueBase = 1n + BigInt(getLevel("click") * (KING_GAME_UPGRADES.click?.value || 1));
    let cpsBase = 0n;
    for (const id in KING_GAME_UPGRADES) { if (id !== "click") { cpsBase += BigInt(getLevel(id)) * BigInt(KING_GAME_UPGRADES[id].cps); } }

    const prestigeBonus = Math.pow(2, user.prestige_level || 0);
    const rankData = RANKS_CONFIG.slice().reverse().find(rank => user.power >= rank.power) || RANKS_CONFIG[0];
    const rankBonus = 1 + (rankData.index * 0.1);

    let totalCoinMultiplier = prestigeBonus * rankBonus;
    
    if (userRoles.coins === 'King') totalCoinMultiplier *= LEADER_BONUSES.coins.King.coin_multiplier;
    if (userRoles.prestige === 'General') totalCoinMultiplier *= LEADER_BONUSES.prestige.General.coin_multiplier;

    let finalClickValue = clickValueBase * BigInt(Math.round(totalCoinMultiplier));
    let finalCps = cpsBase * BigInt(Math.round(totalCoinMultiplier));

    if (active_boosts.x2_coins && new Date(active_boosts.x2_coins) > new Date()) {
        finalClickValue *= 2n;
        finalCps *= 2n;
    }
    
    let mainTitle = userRoles.power || null;
    if(Object.keys(userRoles).length > 1) {
        mainTitle = "Emperor";
    }

    return {
        clickValue: finalClickValue.toString(),
        cps: finalCps.toString(),
        power: user.power.toString(),
        rank: rankData.name,
        title: mainTitle,
        userRoles: userRoles,
        totalBonus: totalCoinMultiplier
    };
};
const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));

exports.handler = async function (event, context) {
    const cookies = event.headers?.cookie ? cookie.parse(event.headers.cookie) : {};
    const token = cookies.auth_token;
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    let decoded;
    try { decoded = jwt.verify(token, process.env.JWT_SECRET); } 
    catch (e) { return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) }; }
    const { id } = decoded;

    if (event.httpMethod === 'GET') {
        const action = event.queryStringParameters.action;
        if (action === 'get_users' || action === 'get_giftable_users') {
             try { const query = action === 'get_giftable_users' ? `SELECT u.discord_id, u.discord_username, k.expires_at FROM users u INNER JOIN keys k ON u.discord_id = k.owner_discord_id WHERE u.user_status != 'Perm' AND k.key_type = 'temp' AND k.expires_at > NOW() ORDER BY u.discord_username` : 'SELECT discord_id, discord_username, power FROM users ORDER BY discord_username'; const { rows } = await db.query(query); return { statusCode: 200, body: JSON.stringify(rows) }; } catch (error) { return { statusCode: 500, body: JSON.stringify({ error: 'Could not fetch user list.' }) }; }
        }
        if (action === 'get_attack_history') {
            try {
                const query = `
                    SELECT a.*, attacker.discord_username as attacker_name, defender.discord_username as defender_name
                    FROM attack_logs a
                    LEFT JOIN users attacker ON a.attacker_id = attacker.discord_id
                    LEFT JOIN users defender ON a.defender_id = defender.discord_id
                    WHERE a.attacker_id = $1 OR a.defender_id = $1
                    ORDER BY a.timestamp DESC LIMIT 30`;
                const { rows } = await db.query(query, [id]);
                return { statusCode: 200, body: JSON.stringify(rows) };
            } catch (error) {
                console.error('Error fetching attack history:', error);
                return { statusCode: 500, body: JSON.stringify({ error: 'Could not fetch attack history.' }) };
            }
        }
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    if (event.httpMethod === 'POST') {
        let has_active_key = false;
        try {
            const { rows } = await db.query('SELECT 1 FROM keys WHERE owner_discord_id = $1 AND (LOWER(key_type) = \'perm\' OR (key_type = \'temp\' AND expires_at > NOW())) LIMIT 1', [id]);
            if (rows.length > 0) {
                has_active_key = true;
            }
        } catch (keyError) {
            console.error("Key validation error:", keyError);
            return { statusCode: 500, body: JSON.stringify({ error: 'An internal server error occurred during key validation.' }) };
        }
        
        const body = JSON.parse(event.body);
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const topPowerRes = await client.query(`SELECT discord_id FROM users ORDER BY power DESC LIMIT 3`);
            const topCoinsRes = await client.query(`SELECT discord_id FROM users ORDER BY king_game_coins::numeric DESC LIMIT 3`);
            const topPrestigeRes = await client.query(`SELECT discord_id FROM users ORDER BY prestige_level DESC, power DESC LIMIT 3`);
            const tops = {
                power: topPowerRes.rows.map(r => r.discord_id),
                coins: topCoinsRes.rows.map(r => r.discord_id),
                prestige: topPrestigeRes.rows.map(r => r.discord_id),
            };

            if (body.action === 'get_leaderboard') {
                let sortByField = 'power';
                let sortOrder = 'DESC';
                if(body.sortBy === 'coins') sortByField = 'king_game_coins::numeric';
                if(body.sortBy === 'prestige') sortByField = 'prestige_level';

                const playersRes = await client.query(`SELECT discord_id, discord_username, power, king_game_coins::text, prestige_level FROM users ORDER BY ${sortByField} ${sortOrder}, power DESC LIMIT 100`);
                
                const processedPlayers = playersRes.rows.map(p => {
                    let topCount = 0;
                    if (tops.power.includes(p.discord_id)) topCount++;
                    if (tops.coins.includes(p.discord_id)) topCount++;
                    if (tops.prestige.includes(p.discord_id)) topCount++;
                    return { ...p, isEmperor: topCount > 1 };
                });

                await client.query('COMMIT'); 
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        players: processedPlayers,
                        tops: tops
                    })
                };
            }

            const userRes = await client.query('SELECT *, king_game_coins::text FROM users WHERE discord_id = $1 FOR UPDATE', [id]);
            if (userRes.rows.length === 0) throw new Error('User not found.');
            let user = userRes.rows[0];
            user.power = BigInt(user.power || '0');
            const now = new Date();
            let responseData = { has_active_key };

            const gameState = await calculateKingGameState(user, tops);
            user.userRoles = gameState.userRoles;

            const { rows: unreadCountRows } = await client.query('SELECT COUNT(*) FROM attack_logs WHERE defender_id = $1 AND is_read = FALSE', [id]);
            responseData.unreadAttackCount = parseInt(unreadCountRows[0].count, 10);
            
            user.reward_available = false;
            const lastReward = user.last_daily_reward_at ? new Date(user.last_daily_reward_at) : null;
            if (has_active_key && Object.keys(user.userRoles).length > 0 && (!lastReward || (now.getTime() - lastReward.getTime()) > 22 * 3600 * 1000)) {
                user.reward_available = true;
            }
            responseData.isRewardAvailable = user.reward_available;

            const lastUpdate = new Date(user.last_king_game_update);
            const secondsDiff = Math.floor((now - lastUpdate) / 1000);
            if (secondsDiff > 0 && has_active_key) { user.king_game_coins = (BigInt(user.king_game_coins || '0') + (BigInt(secondsDiff) * BigInt(gameState.cps))).toString(); }
            
            const { action } = body;
            if (action !== 'load' && action !== 'mark_history_read' && !has_active_key) {
                throw new Error("You need an active key to perform this action.");
            }

            let upgrades = user.king_game_upgrades || {}; let active_boosts = user.active_boosts || {}; let troops = user.troops || {}; let defenses = user.defenses || {};
            
            const performAttack = async (attacker, defender, tops) => {
                const attackerTroopsBefore = deepCopy(attacker.troops);
                const defenderTroopsBefore = deepCopy(defender.troops);
                const defenderDefensesBefore = deepCopy(defender.defenses);
            
                // --- POUVOIR DE BASE (gardé en BigInt) ---
                const attackerBasePower = attacker.power;
                const defenderBasePower = defender.power;
            
                // --- APPLICATION DES BONUS DE RÔLE ---
                const getRole = (userId, category) => { const idx = tops[category].indexOf(userId); return idx === -1 ? null : (idx === 0 ? 'King' : (idx === 1 ? 'Queen' : 'General')); }
                const attackerRole = getRole(attacker.discord_id, 'power');
                const defenderRole = getRole(defender.discord_id, 'power');
            
                let effectiveAttackerPower = Number(attackerBasePower);
                let effectiveDefenderPower = Number(defenderBasePower);

                if (attackerRole && LEADER_BONUSES.power[attackerRole]?.attack_power_multiplier) {
                    effectiveAttackerPower *= LEADER_BONUSES.power[attackerRole].attack_power_multiplier;
                }
                if (defenderRole && LEADER_BONUSES.power[defenderRole]?.defense_power_multiplier) {
                    effectiveDefenderPower *= LEADER_BONUSES.power[defenderRole].defense_power_multiplier;
                }
            
                // --- JET DE COMBAT AVEC FACTEUR ALÉATOIRE ---
                const attackerRoll = effectiveAttackerPower * (Math.random() * 0.5 + 0.75);
                const defenderRoll = effectiveDefenderPower * (Math.random() * 0.5 + 0.75);
            
                // --- NOUVELLE LOGIQUE DE CALCUL DES PERTES (AVEC HAUTE PRÉCISION) ---
                const precision = 10000n; // Multiplicateur pour garder la précision
                
                const attackerLossPercent = attackerBasePower > 0n ? Number(BigInt(Math.round(defenderRoll)) * precision / attackerBasePower) / Number(precision) : 1;
                const defenderLossPercent = defenderBasePower > 0n ? Number(BigInt(Math.round(attackerRoll)) * precision / defenderBasePower) / Number(precision) : 1;

                const finalAttackerLoss = Math.min(1, attackerLossPercent);
                const finalDefenderLoss = Math.min(1, defenderLossPercent);

                const calculateLosses = (unitData, lossPercent) => {
                    if (!unitData || lossPercent <= 0) return unitData;
                    for (const unitId in unitData) {
                        const losses = Math.ceil(unitData[unitId].quantity * lossPercent);
                        unitData[unitId].quantity -= losses;
                        if (unitData[unitId].quantity < 0) unitData[unitId].quantity = 0;
                    }
                    return unitData;
                };
                
                attacker.troops = calculateLosses(attacker.troops, finalAttackerLoss);
                defender.troops = calculateLosses(defender.troops, finalDefenderLoss);
                defender.defenses = calculateLosses(defender.defenses, finalDefenderLoss);

                // --- DÉTERMINATION DU VAINQUEUR POUR LE VOL ---
                const attackerWins = attackerRoll > defenderRoll;
                let stolenAmount = 0n;
                let battleReport = '';

                if (attackerWins) {
                    stolenAmount = BigInt(defender.king_game_coins || '0') / 10n;
                    const attackerCoinRole = getRole(attacker.discord_id, 'coins');
                    if (attackerCoinRole === 'Queen' && LEADER_BONUSES.coins.Queen.steal_multiplier) {
                        stolenAmount = BigInt(Math.round(Number(stolenAmount) * LEADER_BONUSES.coins.Queen.steal_multiplier));
                    }
                    
                    attacker.king_game_coins = (BigInt(attacker.king_game_coins || '0') + stolenAmount).toString();
                    defender.king_game_coins = (BigInt(defender.king_game_coins || '0') - stolenAmount).toString();

                    battleReport = `Victory! You stole ${stolenAmount.toLocaleString('en-US')} coins.`;
                } else {
                    battleReport = `Defeat! Your attack was repelled and you couldn't steal any coins.`;
                }

                // --- RAPPORT DE PERTES ---
                const getLostUnits = (before, after) => {
                    const losses = {};
                    for(const unitId in before) {
                        const lostCount = before[unitId].quantity - (after[unitId]?.quantity || 0);
                        if (lostCount > 0) losses[unitId] = lostCount;
                    }
                    return losses;
                };
                const attackerLosses = getLostUnits(attackerTroopsBefore, attacker.troops);
                const defenderLosses = { ...getLostUnits(defenderTroopsBefore, defender.troops), ...getLostUnits(defenderDefensesBefore, defender.defenses) };
                
                await client.query('INSERT INTO attack_logs (attacker_id, defender_id, attacker_wins, coins_stolen, attacker_losses, defender_losses) VALUES ($1, $2, $3, $4, $5, $6)', [attacker.discord_id, defender.discord_id, attackerWins, stolenAmount.toString(), JSON.stringify(attackerLosses), JSON.stringify(defenderLosses)]);
                
                return { battleReport, attacker, defender };
            };

            if (action === 'mark_history_read') { await client.query('UPDATE attack_logs SET is_read = TRUE WHERE defender_id = $1 AND is_read = FALSE', [id]); responseData.unreadAttackCount = 0; }
            else if (action === 'claim_daily_reward') {
                if (!user.reward_available) throw new Error("No reward available to claim.");
                let hoursToAdd = 0;
                for (const category in user.userRoles) {
                    const role = user.userRoles[category];
                    hoursToAdd += LEADER_REWARDS[category]?.[role] || 0;
                }
                if (hoursToAdd <= 0) throw new Error("You do not hold a rank that grants a daily time reward.");

                const recipientId = body.recipientId; const isGifting = recipientId && user.user_status === 'Perm'; const targetId = isGifting ? recipientId : id;
                const { rows: keyRows } = await client.query('SELECT id, expires_at FROM keys WHERE owner_discord_id = $1 AND key_type = \'temp\' AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1', [targetId]);
                if (keyRows.length > 0) {
                    const newExpiresAt = new Date(new Date(keyRows[0].expires_at).getTime() + hoursToAdd * 3600 * 1000);
                    await client.query('UPDATE keys SET expires_at = $1 WHERE id = $2', [newExpiresAt, keyRows[0].id]);
                    user.last_daily_reward_at = now.toISOString();
                    user.reward_available = false;
                    responseData.message = isGifting ? `Successfully gifted ${hoursToAdd} hours.` : `Successfully claimed ${hoursToAdd} hours.`;
                } else {
                    throw new Error(isGifting ? "The selected player does not have an active temporary key." : "You do not have an active temporary key to extend.");
                }
                responseData.isRewardAvailable = false;
            }
            else if (action === 'send_coins') { const { amount } = body; const amountBigInt = BigInt(amount); if (!body.recipientId || amountBigInt <= 0) throw new Error("Invalid recipient or amount."); if (body.recipientId === id) throw new Error("You cannot send coins to yourself."); if (BigInt(user.king_game_coins || '0') < amountBigInt) throw new Error("Not enough coins to send."); const feePercent = user.userRoles.coins === 'King' ? 0n : 30n; const fee = amountBigInt * feePercent / 100n; const netAmount = amountBigInt - fee; user.king_game_coins = (BigInt(user.king_game_coins || '0') - amountBigInt).toString(); await client.query("UPDATE users SET king_game_coins = king_game_coins::numeric + $1 WHERE discord_id = $2", [netAmount.toString(), body.recipientId]); }
            else if (action === 'click') { user.king_game_coins = (BigInt(user.king_game_coins || '0') + BigInt(gameState.clickValue)).toString(); }
            else if (action === 'buy_upgrade') { const { upgradeId } = body; if (!KING_GAME_UPGRADES[upgradeId]) throw new Error('Invalid upgrade.'); const level = upgrades[upgradeId] || 0; const cost = getUpgradeCost(upgradeId, level, active_boosts, user.userRoles); if (BigInt(user.king_game_coins || '0') < cost) throw new Error("Not enough coins."); user.king_game_coins = (BigInt(user.king_game_coins || '0') - cost).toString(); upgrades[upgradeId] = level + 1; }
            else if (action === 'prestige') { if ((user.prestige_level || 0) >= MAX_PRESTIGE_LEVEL) throw new Error("You have reached the maximum prestige level."); let requirement = PRESTIGE_REQUIREMENT_LEVEL; if (user.userRoles.prestige === 'Queen') requirement -= 5; let canPrestige = true; for (const id in KING_GAME_UPGRADES) { if ((upgrades[id] || 0) < requirement) { canPrestige = false; break; } } if (!canPrestige) throw new Error(`You must have all upgrades at level ${requirement} to prestige.`); user.gems = (user.gems || 0) + (user.userRoles.prestige === 'King' ? 4 : 2); user.prestige_level = (user.prestige_level || 0) + 1; user.king_game_coins = '0'; upgrades = {}; active_boosts = {}; user.time_purchase_count = 0; }
            else if (action === 'buy_boost') { const { boostId } = body; const boost = GEM_BOOSTS[boostId]; if (!boost) throw new Error('Invalid boost.'); if ((user.gems || 0) < boost.cost) throw new Error('Not enough gems.'); if (active_boosts[boostId] && new Date(active_boosts[boostId]) > now) throw new Error('This boost is already active.'); user.gems -= boost.cost; active_boosts[boostId] = new Date(now.getTime() + boost.duration_minutes * 60000).toISOString(); }
            else if (action === 'buy_time') { 
                const hours = parseInt(body.hours, 10); 
                if (!hours || hours <= 0 || hours > 168) throw new Error("Invalid number of hours."); 
                const purchaseCount = BigInt(user.time_purchase_count || 0);
                const costMultiplier = 100n ** purchaseCount;
                const totalCost = (BASE_COST_PER_HOUR * BigInt(hours)) * costMultiplier;
                if (BigInt(user.king_game_coins || '0') < totalCost) throw new Error("Not enough coins to buy time."); 
                const { rows: keyRows } = await client.query('SELECT id, expires_at FROM keys WHERE owner_discord_id = $1 AND key_type = \'temp\' AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1', [id]); 
                if (keyRows.length === 0) throw new Error("You do not have an active temporary key to extend."); 
                user.king_game_coins = (BigInt(user.king_game_coins || '0') - totalCost).toString(); 
                user.time_purchase_count = (user.time_purchase_count || 0) + 1;
                const newExpiresAt = new Date(new Date(keyRows[0].expires_at).getTime() + hours * 3600000); 
                await client.query('UPDATE keys SET expires_at = $1 WHERE id = $2', [newExpiresAt, keyRows[0].id]); 
                responseData.newExpiresAt = newExpiresAt.toISOString(); 
            }
            else if (action === 'buy_troop' || action === 'buy_defense') { const { unitId, quantity } = body; const isTroop = action === 'buy_troop'; const config = isTroop ? ALL_TROOPS_CONFIG[unitId] : DEFENSES_CONFIG[unitId]; if (!config || !quantity || quantity <= 0) throw new Error('Invalid unit or quantity.'); const myPowerTitle = user.userRoles.power; if (isTroop) { if (unitId === 'royal_guard' && myPowerTitle !== 'King') throw new Error('Only the Power King can recruit Royal Guards.'); if (unitId === 'queens_guard' && myPowerTitle !== 'Queen') throw new Error('Only the Power Queen can recruit Queen\'s Guards.'); if (unitId === 'elite_soldier' && !['King', 'Queen', 'General'].includes(myPowerTitle)) throw new Error('Only Top 3 Power players can recruit Elite Soldiers.'); } let totalCost = 0n; const unitData = isTroop ? troops : defenses; const currentQuantity = unitData[unitId]?.quantity || 0; for(let i=0; i<quantity; i++){ totalCost += getUnitCost(unitId, currentQuantity + i, isTroop, user.userRoles); } if (BigInt(user.king_game_coins || '0') < totalCost) throw new Error('Not enough coins.'); user.king_game_coins = (BigInt(user.king_game_coins || '0') - totalCost).toString(); if (!unitData[unitId]) unitData[unitId] = { quantity: 0, level: 1 }; unitData[unitId].quantity += quantity; if (isTroop) user.troops = unitData; else user.defenses = unitData; }
            else if (action === 'attack_player' || action === 'revenge_attack') {
                let targetId;
                if (action === 'revenge_attack') {
                    const { logId } = body;
                    if (!logId) throw new Error('Attack log ID is missing for revenge.');
                    const logRes = await client.query('SELECT * FROM attack_logs WHERE id = $1', [logId]);
                    if (logRes.rows.length === 0) throw new Error('Attack log not found.');
                    const log = logRes.rows[0];
                    if (log.defender_id !== id) throw new Error('This is not your battle to revenge.');
                    if (log.revenge_used) throw new Error('Revenge has already been used for this attack.');
                    targetId = log.attacker_id;
                    await client.query('UPDATE attack_logs SET revenge_used = TRUE WHERE id = $1', [logId]);
                } else {
                    targetId = body.targetId;
                    if (!targetId || targetId === id) throw new Error('Invalid target.');
                    const lastAttacks = user.last_attack_timestamps || {}; if (lastAttacks[targetId] && (now.getTime() - new Date(lastAttacks[targetId]).getTime()) < 5 * 60 * 1000) throw new Error('You can only attack this player once every 5 minutes.');
                }
                const targetRes = await client.query('SELECT *, king_game_coins::text FROM users WHERE discord_id = $1 FOR UPDATE', [targetId]);
                if (targetRes.rows.length === 0) throw new Error('Target player not found.');
                let targetUser = targetRes.rows[0]; targetUser.power = BigInt(targetUser.power || '0');
                const { battleReport, attacker, defender } = await performAttack(user, targetUser, tops);
                user = attacker; targetUser = defender; responseData.battleReport = battleReport;
                user.power = calculatePower(user); targetUser.power = calculatePower(targetUser);
                await client.query('UPDATE users SET king_game_coins = $1, troops = $2, defenses = $3, power = $4, last_king_game_update = $6 WHERE discord_id = $5', [targetUser.king_game_coins.toString(), JSON.stringify(targetUser.troops), JSON.stringify(targetUser.defenses), targetUser.power.toString(), targetId, now.toISOString()]);
                if (action === 'attack_player') { const lastAttacks = user.last_attack_timestamps || {}; lastAttacks[targetId] = now.toISOString(); user.last_attack_timestamps = lastAttacks; }
            }
            
            user.power = calculatePower(user);
            await client.query( `UPDATE users SET king_game_coins = $1, king_game_upgrades = $2, last_king_game_update = $3, prestige_level = $4, gems = $5, active_boosts = $6, power = $7, troops = $8, defenses = $9, last_attack_timestamps = $10, last_daily_reward_at = $12, reward_available = $13, time_purchase_count = $14 WHERE discord_id = $11`, [user.king_game_coins.toString(), JSON.stringify(upgrades), now.toISOString(), user.prestige_level || 0, user.gems || 0, JSON.stringify(active_boosts), user.power.toString(), JSON.stringify(troops), JSON.stringify(defenses), JSON.stringify(user.last_attack_timestamps || {}), id, user.last_daily_reward_at, user.reward_available, user.time_purchase_count || 0] );
            
            await client.query('COMMIT');

            const finalGameState = await calculateKingGameState(user, tops);
            const finalResponse = {
                coins: user.king_game_coins.toString(), upgrades: upgrades, prestige_level: user.prestige_level || 0, gems: user.gems || 0,
                troops: troops, defenses: defenses, active_boosts: Object.fromEntries(Object.entries(active_boosts).filter(([_,exp]) => new Date(exp) > now)),
                power: finalGameState.power, rank: finalGameState.rank, cps: finalGameState.cps, clickValue: finalGameState.clickValue, title: finalGameState.title,
                totalBonus: finalGameState.totalBonus, userRoles: finalGameState.userRoles,
                time_purchase_count: user.time_purchase_count || 0,
                ...responseData
            };
            return { statusCode: 200, body: JSON.stringify(finalResponse) };
        } catch (error) {
            await client.query('ROLLBACK');
            return { statusCode: 400, body: JSON.stringify({ error: error.message || 'An internal server error occurred.' }) };
        } finally {
            client.release();
        }
    }
    return { statusCode: 405, body: 'Method Not Allowed' };
};
