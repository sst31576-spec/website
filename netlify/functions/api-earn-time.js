// netlify/functions/api-earn-time.js
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db'); // Utilise uniquement la connexion principale

// --- GAME CONFIGURATION ---
const PRESTIGE_REQUIREMENT_LEVEL = 75; const MAX_PRESTIGE_LEVEL = 20;
const TROOPS_CONFIG = { 'warrior': { name: 'Warrior', cost: 10000, power: 10, costMultiplier: 1.05 }, 'archer': { name: 'Archer', cost: 50000, power: 45, costMultiplier: 1.06 }, 'knight': { name: 'Knight', cost: 250000, power: 220, costMultiplier: 1.07 }, 'mage': { name: 'Mage', cost: 1200000, power: 1100, costMultiplier: 1.08 }, 'dragon': { name: 'Dragon', cost: 8000000, power: 6500, costMultiplier: 1.1 },};
const SPECIAL_UNITS_CONFIG = { 'elite_soldier': { name: 'Elite Soldier', cost: 5000000, power: 3000, costMultiplier: 1.12 }, 'queens_guard': { name: 'Queen\'s Guard', cost: 25000000, power: 12000, costMultiplier: 1.15 }, 'royal_guard': { name: 'Royal Guard', cost: 100000000, power: 50000, costMultiplier: 1.2 },};
const ALL_TROOPS_CONFIG = { ...TROOPS_CONFIG, ...SPECIAL_UNITS_CONFIG };
const DEFENSES_CONFIG = { 'wall': { name: 'Wooden Wall', cost: 15000, power: 15, costMultiplier: 1.05 }, 'tower': { name: 'Watchtower', cost: 70000, power: 60, costMultiplier: 1.06 }, 'fortress': { name: 'Fortress', cost: 350000, power: 280, costMultiplier: 1.07 }, 'cannon': { name: 'Cannon', cost: 1800000, power: 1500, costMultiplier: 1.08 }, 'magic_shield': { name: 'Magic Shield', cost: 10000000, power: 8000, costMultiplier: 1.1 },};
const RANKS_CONFIG = []; const rankTiers = ['Bronze', 'Iron', 'Steel', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Emerald', 'Ruby', 'Sapphire', 'Amethyst', 'Topaz', 'Jade', 'Opal', 'Onyx', 'Quartz', 'Titanium', 'Obsidian', 'Mythril', 'Adamantite']; const subRanks = ['V', 'IV', 'III', 'II', 'I']; let powerThreshold = 1000; let rankIndex = 0; RANKS_CONFIG.push({ power: 0, name: 'Unranked', index: rankIndex }); rankIndex++; for (const tier of rankTiers) { for (const sub of subRanks) { RANKS_CONFIG.push({ power: powerThreshold, name: `${tier} ${sub}`, index: rankIndex }); powerThreshold = Math.floor(powerThreshold * 1.4); rankIndex++; } powerThreshold = Math.floor(powerThreshold * 1.2); }
const KING_GAME_UPGRADES = { click: { name: 'Royal Scepter', baseCost: 15, costMultiplier: 1.15, value: 1 }, b1: { name: 'Peasant Hut', baseCost: 100, costMultiplier: 1.1, cps: 1 }, b2: { name: 'Farm', baseCost: 1100, costMultiplier: 1.12, cps: 8 }, b3: { name: 'Bakery', baseCost: 8500, costMultiplier: 1.13, cps: 35 }, b4: { name: 'Blacksmith', baseCost: 40000, costMultiplier: 1.13, cps: 150 }, b5: { name: 'Market', baseCost: 210000, costMultiplier: 1.14, cps: 720 }, b6: { name: 'Inn', baseCost: 1.4e6, costMultiplier: 1.15, cps: 3800 }, b7: { name: 'Guard Tower', baseCost: 9e6, costMultiplier: 1.15, cps: 21000 }, b8: { name: 'Church', baseCost: 5.5e7, costMultiplier: 1.16, cps: 115000 }, b9: { name: 'Library', baseCost: 3.8e8, costMultiplier: 1.16, cps: 650000 }, b10: { name: 'Town Hall', baseCost: 2.5e9, costMultiplier: 1.17, cps: 3.4e6 }, b11: { name: 'Castle', baseCost: 1.8e10, costMultiplier: 1.18, cps: 2e7 }, b12: { name: 'Barracks', baseCost: 1.2e11, costMultiplier: 1.18, cps: 1.1e8 }, b13: { name: 'University', baseCost: 8e11, costMultiplier: 1.19, cps: 6e8 }, b14: { name: 'Cathedral', baseCost: 5.2e12, costMultiplier: 1.19, cps: 3.5e9 }, b15: { name: 'Royal Palace', baseCost: 3.6e13, costMultiplier: 1.2, cps: 2.2e10 }, b16: { name: 'Kingdom', baseCost: 2.8e14, costMultiplier: 1.21, cps: 1.5e11 }, b17: { name: 'Empire', baseCost: 2.1e15, costMultiplier: 1.21, cps: 9e11 }, b18: { name: 'Senate', baseCost: 1.5e16, costMultiplier: 1.22, cps: 5.5e12 }, b19: { name: 'Colosseum', baseCost: 1.1e17, costMultiplier: 1.22, cps: 3e13 }, b20: { name: 'Grand Temple', baseCost: 8e17, costMultiplier: 1.23, cps: 1.8e14 },};
const highTierNames = [ 'Quantum Forge', 'Nebula Reactor', 'Stargate Hub', 'Galactic Exchange', 'Celestial Spire', 'Ethereal Nexus', 'Singularity Core', 'Hyperspace Beacon', 'Chrono-Synth Factory', 'Void Matter Extractor', 'Cosmic Oracle', 'Stellar Shipyard', 'Dimension Weaver', 'Reality Engine', 'Genesis Chamber', 'Omega Citadel', 'Astro-Observatory', 'Dark Matter Plant', 'Supernova Catalyst', 'Infinity Gate', 'Celestial Forge', 'Stardust Silo', 'Event Horizon Lab', 'Galaxy Brain Nexus', 'Time Dilation Spire', 'Reality Bender', 'The Omniverse', 'Finality Point', 'The Great Attractor', 'The Void' ];
let lastCps = BigInt('180000000000000'); let lastCost = BigInt('800000000000000000');
for (let i = 21; i <= 50; i++) { const cpsMultiplier = BigInt(Math.round((5 + i * 0.1) * 10)); const costMultiplier = BigInt(Math.round((6 + i * 0.15) * 100)); lastCps = (lastCps * cpsMultiplier) / 10n; lastCost = (lastCost * costMultiplier) / 100n; const name = highTierNames[i - 21] || `Cosmic Entity #${i - 20}`; KING_GAME_UPGRADES[`b${i}`] = { name: name, baseCost: lastCost, costMultiplier: 1.23 + (i * 0.002), cps: lastCps };}
const GEM_BOOSTS = { 'x2_coins': { name: '2x Coin Boost', cost: 10, duration_minutes: 60 }, 'half_cost': { name: '50% Upgrade Discount', cost: 5, duration_minutes: 5 },};
const COST_PER_HOUR = BigInt('77045760000');

const getUpgradeCost = (u, c, a) => { const r = KING_GAME_UPGRADES[u], t = BigInt(r.baseCost); let e = BigInt(Math.ceil(Number(t) * Math.pow(r.costMultiplier, c))); return a && a.half_cost && new Date(a.half_cost) > new Date && (e /= 2n), e };
const getUnitCost = (u, c, i) => { const t = i ? ALL_TROOPS_CONFIG[u] : DEFENSES_CONFIG[u]; return BigInt(Math.ceil(t.cost * Math.pow(t.costMultiplier, c))) };
const calculatePower = u => { let c = 0; const a = u.troops || {}, r = u.defenses || {}; for (const t in a) { if(ALL_TROOPS_CONFIG[t]) c += (a[t].level || 1) * ALL_TROOPS_CONFIG[t].power * (a[t].quantity || 0) }; for (const t in r) { if(DEFENSES_CONFIG[t]) c += (r[t].level || 1) * DEFENSES_CONFIG[t].power * (r[t].quantity || 0) }; return BigInt(c) };
const calculateKingGameState = async (u, c) => { const a = u.king_game_upgrades || {}, r = u.active_boosts || {}, t = u => a[u] || 0; let e = 1n + BigInt(t("click") * (KING_GAME_UPGRADES.click?.value || 1)), o = 0n; for (const i in KING_GAME_UPGRADES) "click" !== i && (o += BigInt(t(i)) * BigInt(KING_GAME_UPGRADES[i].cps)); let s = Math.pow(2, u.prestige_level || 0), n = s; const l = RANKS_CONFIG.slice().reverse().find(c => u.power >= c.power) || RANKS_CONFIG[0]; n *= Math.pow(1.1, l.index); const g = c.findIndex(c => c.discord_id === u.discord_id); let p = null; 0 === g ? (n *= 1.5, p = "King") : 1 === g ? (n *= 2, p = "Queen") : 2 === g && (p = "General"); let d = e * BigInt(Math.round(n)), i = o * BigInt(Math.round(n)); return r.x2_coins && new Date(r.x2_coins) > new Date && (d *= 2n, i *= 2n), { clickValue: d.toString(), cps: i.toString(), power: u.power.toString(), rank: l.name, title: p } };
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
             try {
                const query = action === 'get_giftable_users'
                    ? `SELECT u.discord_id, u.discord_username, k.expires_at FROM users u INNER JOIN keys k ON u.discord_id = k.owner_discord_id WHERE u.user_status != 'Perm' AND k.key_type = 'temp' AND k.expires_at > NOW() ORDER BY u.discord_username`
                    : 'SELECT discord_id, discord_username, power FROM users ORDER BY discord_username';
                const { rows } = await db.query(query);
                return { statusCode: 200, body: JSON.stringify(rows) };
            } catch (error) { return { statusCode: 500, body: JSON.stringify({ error: 'Could not fetch user list.' }) }; }
        }
        if (action === 'get_attack_history') {
            try {
                const { rows } = await db.query(`
                    SELECT a.*, u.discord_username as attacker_name 
                    FROM attack_logs a
                    JOIN users u ON a.attacker_id = u.discord_id
                    WHERE a.defender_id = $1 
                    ORDER BY a.timestamp DESC 
                    LIMIT 30`, [id]);
                return { statusCode: 200, body: JSON.stringify(rows) };
            } catch (error) { return { statusCode: 500, body: JSON.stringify({ error: 'Could not fetch attack history.' }) }; }
        }
        try { const { rows } = await db.query('SELECT expires_at FROM keys WHERE owner_discord_id = $1 AND (key_type = \'perm\' OR (key_type = \'temp\' AND expires_at > NOW())) LIMIT 1', [id]); if (rows.length === 0) return { statusCode: 404, body: JSON.stringify({ error: 'You do not have an active key to play with.' }) }; return { statusCode: 200, body: JSON.stringify({ expires_at: rows[0].expires_at }) }; } catch (error) { return { statusCode: 500, body: JSON.stringify({ error: 'An internal server error occurred.' }) }; }
    }
    if (event.httpMethod === 'POST') {
        const body = JSON.parse(event.body);
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const userRes = await client.query('SELECT *, king_game_coins::text FROM users WHERE discord_id = $1 FOR UPDATE', [id]);
            if (userRes.rows.length === 0) throw new Error('User not found.');
            let user = userRes.rows[0];
            user.power = BigInt(user.power || '0');
            const topPlayersRes = await client.query('SELECT discord_id, power, troops FROM users ORDER BY power DESC LIMIT 3');
            const topPlayers = topPlayersRes.rows;
            const now = new Date();
            let responseData = {};

            const { rows: unreadCountRows } = await client.query('SELECT COUNT(*) FROM attack_logs WHERE defender_id = $1 AND is_read = FALSE', [id]);
            responseData.unreadAttackCount = parseInt(unreadCountRows[0].count, 10);

            const userPosition = topPlayers.findIndex(p => p.discord_id === id);
            if (userPosition !== -1) { const lastReward = user.last_daily_reward_at ? new Date(user.last_daily_reward_at) : null; if (!lastReward || (now.getTime() - lastReward.getTime()) > 22 * 3600 * 1000) { responseData.isRewardAvailable = true; } }
            const lastUpdate = new Date(user.last_king_game_update);
            const secondsDiff = Math.floor((now - lastUpdate) / 1000);
            if (secondsDiff > 0) { const { cps } = await calculateKingGameState(user, topPlayers); user.king_game_coins = (BigInt(user.king_game_coins) + (BigInt(secondsDiff) * BigInt(cps))).toString(); }
            const { action } = body;
            let upgrades = user.king_game_upgrades || {}; let active_boosts = user.active_boosts || {}; let troops = user.troops || {}; let defenses = user.defenses || {};
            
            const performAttack = async (attacker, defender, isRevenge) => {
                const attackerTroopsBefore = deepCopy(attacker.troops);
                const defenderTroopsBefore = deepCopy(defender.troops);
                const defenderDefensesBefore = deepCopy(defender.defenses);

                let attackerPower = attacker.power; let defenderPower = defender.power; const attackerPos = topPlayers.findIndex(p => p.discord_id === attacker.discord_id); const defenderPos = topPlayers.findIndex(p => p.discord_id === defender.discord_id); if (attackerPos === 0) attackerPower = attackerPower * 2n; if (attackerPos === 2) attackerPower = attackerPower * 15n / 10n; if (defenderPos === 0) defenderPower = defenderPower * 2n; if (defenderPos === 2) defenderPower = defenderPower * 15n / 10n;
                const attackerRoll = Number(attackerPower) * (Math.random() * 0.5 + 0.75); const defenderRoll = Number(defenderPower) * (Math.random() * 0.5 + 0.75);
                const attackerWins = attackerRoll > defenderRoll;
                const calculateLosses = (unitData, lossPercent) => { if (!unitData) return {}; for (const unitId in unitData) { const losses = Math.ceil(unitData[unitId].quantity * lossPercent); unitData[unitId].quantity -= losses; if (unitData[unitId].quantity < 0) unitData[unitId].quantity = 0; } return unitData; };
                
                let stolenAmount = 0n; let battleReport;
                if (attackerWins) {
                    stolenAmount = BigInt(defender.king_game_coins) / 10n; attacker.king_game_coins = (BigInt(attacker.king_game_coins) + stolenAmount).toString(); defender.king_game_coins = (BigInt(defender.king_game_coins) - stolenAmount).toString();
                    attacker.troops = calculateLosses(attacker.troops, 0.10); defender.troops = calculateLosses(defender.troops, 0.25); defender.defenses = calculateLosses(defender.defenses, 0.10);
                    battleReport = isRevenge ? `Revenge successful! You stole ${stolenAmount.toLocaleString('en-US')} coins.` : `Victory! You stole ${stolenAmount.toLocaleString('en-US')} coins.`;
                } else {
                    for(const troopId in attacker.troops) { if(!SPECIAL_UNITS_CONFIG[troopId]) attacker.troops[troopId].quantity = 0; }
                    defender.troops = calculateLosses(defender.troops, 0.10); defender.defenses = calculateLosses(defender.defenses, 0.05);
                    battleReport = isRevenge ? `Revenge failed! Your army was wiped out.` : `Total Defeat! Your regular army was wiped out.`;
                }
                
                const getLostUnits = (before, after) => { const losses = {}; for(const unitId in before) { const lostCount = before[unitId].quantity - (after[unitId]?.quantity || 0); if (lostCount > 0) losses[unitId] = lostCount; } return losses; };
                const attackerLosses = getLostUnits(attackerTroopsBefore, attacker.troops);
                const defenderLosses = { ...getLostUnits(defenderTroopsBefore, defender.troops), ...getLostUnits(defenderDefensesBefore, defender.defenses) };
                
                await client.query('INSERT INTO attack_logs (attacker_id, defender_id, attacker_wins, coins_stolen, attacker_losses, defender_losses) VALUES ($1, $2, $3, $4, $5, $6)', [attacker.discord_id, defender.discord_id, attackerWins, stolenAmount.toString(), JSON.stringify(attackerLosses), JSON.stringify(defenderLosses)]);
                
                return { battleReport, attacker, defender };
            };
            
            if (action === 'mark_history_read') {
                await client.query('UPDATE attack_logs SET is_read = TRUE WHERE defender_id = $1 AND is_read = FALSE', [id]);
                responseData.unreadAttackCount = 0;
            }
            else if (action === 'claim_daily_reward') { if (userPosition === -1) throw new Error("You are not in the Top 3 to claim a reward."); const lastReward = user.last_daily_reward_at ? new Date(user.last_daily_reward_at) : null; if (lastReward && (now.getTime() - lastReward.getTime()) < 22 * 60 * 60 * 1000) throw new Error("You have already claimed your daily reward."); let hoursToAdd = 0; if (userPosition === 0) hoursToAdd = 3; else if (userPosition === 1) hoursToAdd = 2; else if (userPosition === 2) hoursToAdd = 1; if (hoursToAdd > 0) { const recipientId = body.recipientId; const isGifting = recipientId && user.user_status === 'Perm'; const targetId = isGifting ? recipientId : id; const { rows: keyRows } = await client.query('SELECT id, expires_at FROM keys WHERE owner_discord_id = $1 AND key_type = \'temp\' AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1', [targetId]); if (keyRows.length > 0) { const newExpiresAt = new Date(new Date(keyRows[0].expires_at).getTime() + hoursToAdd * 3600 * 1000); await client.query('UPDATE keys SET expires_at = $1 WHERE id = $2', [newExpiresAt, keyRows[0].id]); user.last_daily_reward_at = now.toISOString(); responseData.message = isGifting ? `Successfully gifted ${hoursToAdd} hours.` : `Successfully claimed ${hoursToAdd} hours.`; } else { throw new Error(isGifting ? "The selected player does not have an active temporary key." : "You do not have an active temporary key to extend."); } } responseData.isRewardAvailable = false; }
            else if (action === 'get_leaderboard') { await client.query('ROLLBACK'); const sortBy = body.sortBy || 'power'; let orderByClause; switch(sortBy) { case 'coins': orderByClause = 'king_game_coins::numeric DESC'; break; case 'prestige': orderByClause = 'prestige_level DESC, power DESC'; break; default: orderByClause = 'power DESC'; } const leaderboardRes = await db.query(`SELECT discord_username, power, king_game_coins::text, prestige_level FROM users ORDER BY ${orderByClause} LIMIT 50`); return { statusCode: 200, body: JSON.stringify(leaderboardRes.rows) }; }
            else if (action === 'send_coins') { const { amount } = body; const amountBigInt = BigInt(amount); if (!body.recipientId || amountBigInt <= 0) throw new Error("Invalid recipient or amount."); if (body.recipientId === id) throw new Error("You cannot send coins to yourself."); if (BigInt(user.king_game_coins) < amountBigInt) throw new Error("Not enough coins to send."); const fee = amountBigInt * 30n / 100n; const netAmount = amountBigInt - fee; user.king_game_coins = (BigInt(user.king_game_coins) - amountBigInt).toString(); await client.query("UPDATE users SET king_game_coins = king_game_coins::numeric + $1 WHERE discord_id = $2", [netAmount.toString(), body.recipientId]); }
            else if (action === 'click') { const { clickValue } = await calculateKingGameState(user, topPlayers); user.king_game_coins = (BigInt(user.king_game_coins) + BigInt(clickValue)).toString(); }
            else if (action === 'buy_upgrade') { const { upgradeId } = body; if (!KING_GAME_UPGRADES[upgradeId]) throw new Error('Invalid upgrade.'); const level = upgrades[upgradeId] || 0; const cost = getUpgradeCost(upgradeId, level, active_boosts); if (BigInt(user.king_game_coins) < cost) throw new Error("Not enough coins."); user.king_game_coins = (BigInt(user.king_game_coins) - cost).toString(); upgrades[upgradeId] = level + 1; }
            else if (action === 'prestige') { if ((user.prestige_level || 0) >= MAX_PRESTIGE_LEVEL) throw new Error("You have reached the maximum prestige level."); let canPrestige = true; for (const id in KING_GAME_UPGRADES) { if ((upgrades[id] || 0) < PRESTIGE_REQUIREMENT_LEVEL) { canPrestige = false; break; } } if (!canPrestige) throw new Error(`You must have all upgrades at level ${PRESTIGE_REQUIREMENT_LEVEL} to prestige.`); user.gems = (user.gems || 0) + 2; user.prestige_level = (user.prestige_level || 0) + 1; user.king_game_coins = '0'; upgrades = {}; active_boosts = {}; }
            else if (action === 'buy_boost') { const { boostId } = body; const boost = GEM_BOOSTS[boostId]; if (!boost) throw new Error('Invalid boost.'); if ((user.gems || 0) < boost.cost) throw new Error('Not enough gems.'); if (active_boosts[boostId] && new Date(active_boosts[boostId]) > now) throw new Error('This boost is already active.'); user.gems -= boost.cost; active_boosts[boostId] = new Date(now.getTime() + boost.duration_minutes * 60000).toISOString(); }
            else if (action === 'buy_time') { const hours = parseInt(body.hours, 10); if (!hours || hours <= 0 || hours > 168) throw new Error("Invalid number of hours."); const totalCost = COST_PER_HOUR * BigInt(hours); if (BigInt(user.king_game_coins) < totalCost) throw new Error("Not enough coins to buy time."); const { rows: keyRows } = await client.query('SELECT id, expires_at FROM keys WHERE owner_discord_id = $1 AND key_type = \'temp\' AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1', [id]); if (keyRows.length === 0) throw new Error("You do not have an active temporary key to extend."); user.king_game_coins = (BigInt(user.king_game_coins) - totalCost).toString(); const newExpiresAt = new Date(new Date(keyRows[0].expires_at).getTime() + hours * 3600000); await client.query('UPDATE keys SET expires_at = $1 WHERE id = $2', [newExpiresAt, keyRows[0].id]); responseData.newExpiresAt = newExpiresAt.toISOString(); }
            else if (action === 'buy_troop') { const { unitId, quantity } = body; if (!ALL_TROOPS_CONFIG[unitId] || !quantity || quantity <= 0) throw new Error('Invalid unit or quantity.'); const myTitle = (await calculateKingGameState(user, topPlayers)).title; if (unitId === 'royal_guard' && myTitle !== 'King') throw new Error('Only the King can recruit Royal Guards.'); if (unitId === 'queens_guard' && myTitle !== 'Queen') throw new Error('Only the Queen can recruit Queen\'s Guards.'); if (unitId === 'elite_soldier' && !['King', 'Queen', 'General'].includes(myTitle)) throw new Error('Only Top 3 players can recruit Elite Soldiers.'); if (myTitle === 'King' && unitId === 'queens_guard') throw new Error('The King cannot recruit Queen\'s Guards.'); let totalCost = 0n; const currentQuantity = troops[unitId]?.quantity || 0; for(let i=0; i<quantity; i++){ totalCost += getUnitCost(unitId, currentQuantity + i, true); } if (BigInt(user.king_game_coins) < totalCost) throw new Error('Not enough coins.'); user.king_game_coins = (BigInt(user.king_game_coins) - totalCost).toString(); if (!troops[unitId]) troops[unitId] = { quantity: 0, level: 1 }; troops[unitId].quantity += quantity; }
            else if (action === 'buy_defense') { const { unitId, quantity } = body; const config = DEFENSES_CONFIG[unitId]; const unitData = defenses; if (!config || !quantity || quantity <= 0) throw new Error('Invalid unit or quantity.'); let totalCost = 0n; const currentQuantity = unitData[unitId]?.quantity || 0; for(let i=0; i<quantity; i++){ totalCost += getUnitCost(unitId, currentQuantity + i, false); } if (BigInt(user.king_game_coins) < totalCost) throw new Error('Not enough coins.'); user.king_game_coins = (BigInt(user.king_game_coins) - totalCost).toString(); if (!unitData[unitId]) unitData[unitId] = { quantity: 0, level: 1 }; unitData[unitId].quantity += quantity; }
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
                    const lastAttacks = user.last_attack_timestamps || {}; if (lastAttacks[targetId] && (now.getTime() - new Date(lastAttacks[targetId]).getTime()) < 24 * 3600 * 1000) throw new Error('You can only attack this player once every 24 hours.');
                }

                const oldTop3 = topPlayers.map(p => p.discord_id);
                if (topPlayers[1] && targetId === topPlayers[1].discord_id) throw new Error('The Queen is protected and cannot be attacked.');
                
                const targetRes = await client.query('SELECT *, king_game_coins::text FROM users WHERE discord_id = $1 FOR UPDATE', [targetId]);
                if (targetRes.rows.length === 0) throw new Error('Target player not found.');
                let targetUser = targetRes.rows[0]; targetUser.power = BigInt(targetUser.power || '0');
                
                const { battleReport, attacker, defender } = await performAttack(user, targetUser, action === 'revenge_attack');
                user = attacker;
                targetUser = defender;
                responseData.battleReport = battleReport;

                user.power = calculatePower(user); targetUser.power = calculatePower(targetUser);
                await client.query('UPDATE users SET king_game_coins = $1, troops = $2, defenses = $3, power = $4 WHERE discord_id = $5', [targetUser.king_game_coins, JSON.stringify(targetUser.troops), JSON.stringify(targetUser.defenses), targetUser.power.toString(), targetId]);
                if (action === 'attack_player') { const lastAttacks = user.last_attack_timestamps || {}; lastAttacks[targetId] = now.toISOString(); user.last_attack_timestamps = lastAttacks; }
                const newTopPlayersRes = await client.query('SELECT discord_id, troops FROM users ORDER BY power DESC LIMIT 3'); const newTop3 = newTopPlayersRes.rows.map(p => p.discord_id);
                for (let i = 0; i < 3; i++) { const oldRulerId = oldTop3[i]; const newRulerId = newTop3[i]; if (oldRulerId && newRulerId && oldRulerId !== newRulerId) { const specialUnits = { 0: 'royal_guard', 1: 'queens_guard', 2: 'elite_soldier' }; const unitToTransfer = specialUnits[i]; const oldRulerRes = await client.query('SELECT troops FROM users WHERE discord_id = $1 FOR UPDATE', [oldRulerId]); let oldRulerTroops = oldRulerRes.rows[0].troops || {}; const newRulerRes = await client.query('SELECT troops FROM users WHERE discord_id = $1 FOR UPDATE', [newRulerId]); let newRulerTroops = newRulerRes.rows[0].troops || {}; const quantityToTransfer = oldRulerTroops[unitToTransfer]?.quantity || 0; if (quantityToTransfer > 0) { if (!newRulerTroops[unitToTransfer]) newRulerTroops[unitToTransfer] = { quantity: 0, level: 1 }; newRulerTroops[unitToTransfer].quantity += quantityToTransfer; oldRulerTroops[unitToTransfer].quantity = 0; await client.query('UPDATE users SET troops = $1 WHERE discord_id = $2', [JSON.stringify(oldRulerTroops), oldRulerId]); await client.query('UPDATE users SET troops = $1 WHERE discord_id = $2', [JSON.stringify(newRulerTroops), newRulerId]); } } }
            }
            
            user.power = calculatePower(user);
            await client.query( `UPDATE users SET king_game_coins = $1, king_game_upgrades = $2, last_king_game_update = $3, prestige_level = $4, gems = $5, active_boosts = $6, power = $7, troops = $8, defenses = $9, last_attack_timestamps = $10, last_daily_reward_at = $12 WHERE discord_id = $11`, [user.king_game_coins, JSON.stringify(upgrades), now.toISOString(), user.prestige_level || 0, user.gems || 0, JSON.stringify(active_boosts), user.power.toString(), JSON.stringify(troops), JSON.stringify(defenses), JSON.stringify(user.last_attack_timestamps || {}), id, user.last_daily_reward_at] );
            
            await client.query('COMMIT');

            const finalGameState = await calculateKingGameState(user, (await db.query('SELECT discord_id, power FROM users ORDER BY power DESC LIMIT 3')).rows);
            const finalResponse = {
                coins: user.king_game_coins, upgrades: upgrades, prestige_level: user.prestige_level || 0, gems: user.gems || 0,
                troops: troops, defenses: defenses, active_boosts: Object.fromEntries(Object.entries(active_boosts).filter(([_,exp]) => new Date(exp) > now)),
                power: finalGameState.power, rank: finalGameState.rank, cps: finalGameState.cps, clickValue: finalGameState.clickValue, title: finalGameState.title,
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
