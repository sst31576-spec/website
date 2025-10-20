// netlify/functions/api-earn-time.js
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const db = require('./db');

// --- GAME CONFIGURATION ---
const PRESTIGE_REQUIREMENT_LEVEL = 75; const MAX_PRESTIGE_LEVEL = 20;
const TROOPS_CONFIG = { 'warrior': { name: 'Warrior', cost: 10000, power: 10, costMultiplier: 1.05 }, 'archer': { name: 'Archer', cost: 50000, power: 45, costMultiplier: 1.06 }, 'knight': { name: 'Knight', cost: 250000, power: 220, costMultiplier: 1.07 }, 'mage': { name: 'Mage', cost: 1200000, power: 1100, costMultiplier: 1.08 }, 'dragon': { name: 'Dragon', cost: 8000000, power: 6500, costMultiplier: 1.1 },};
const DEFENSES_CONFIG = { 'wall': { name: 'Wooden Wall', cost: 15000, power: 15, costMultiplier: 1.05 }, 'tower': { name: 'Watchtower', cost: 70000, power: 60, costMultiplier: 1.06 }, 'fortress': { name: 'Fortress', cost: 350000, power: 280, costMultiplier: 1.07 }, 'cannon': { name: 'Cannon', cost: 1800000, power: 1500, costMultiplier: 1.08 }, 'magic_shield': { name: 'Magic Shield', cost: 10000000, power: 8000, costMultiplier: 1.1 },};
const RANKS_CONFIG = [ { power: 0, name: 'Unranked', index: 0 }, { power: 1000, name: 'Bronze III', index: 1 }, { power: 2500, name: 'Bronze II', index: 2 }, { power: 5000, name: 'Bronze I', index: 3 }, { power: 10000, name: 'Silver III', index: 4 }, { power: 20000, name: 'Silver II', index: 5 }, { power: 40000, name: 'Silver I', index: 6 }, { power: 75000, name: 'Gold III', index: 7 }, { power: 150000, name: 'Gold II', index: 8 }, { power: 300000, name: 'Gold I', index: 9 }, { power: 1000000, name: 'Platinum', index: 10 }, { power: 5000000, name: 'Diamond', index: 11 }, { power: 25000000, name: 'Master', index: 12 }, { power: 100000000, name: 'Legend', index: 13 }, ];
const KING_GAME_UPGRADES = { click: { name: 'Royal Scepter', baseCost: 15, costMultiplier: 1.15, value: 1 }, b1: { name: 'Peasant Hut', baseCost: 100, costMultiplier: 1.1, cps: 1 }, b2: { name: 'Farm', baseCost: 1100, costMultiplier: 1.12, cps: 8 }, b3: { name: 'Bakery', baseCost: 8500, costMultiplier: 1.13, cps: 35 }, b4: { name: 'Blacksmith', baseCost: 40000, costMultiplier: 1.13, cps: 150 }, b5: { name: 'Market', baseCost: 210000, costMultiplier: 1.14, cps: 720 }, b6: { name: 'Inn', baseCost: 1.4e6, costMultiplier: 1.15, cps: 3800 }, b7: { name: 'Guard Tower', baseCost: 9e6, costMultiplier: 1.15, cps: 21000 }, b8: { name: 'Church', baseCost: 5.5e7, costMultiplier: 1.16, cps: 115000 }, b9: { name: 'Library', baseCost: 3.8e8, costMultiplier: 1.16, cps: 650000 }, b10: { name: 'Town Hall', baseCost: 2.5e9, costMultiplier: 1.17, cps: 3.4e6 }, b11: { name: 'Castle', baseCost: 1.8e10, costMultiplier: 1.18, cps: 2e7 }, b12: { name: 'Barracks', baseCost: 1.2e11, costMultiplier: 1.18, cps: 1.1e8 }, b13: { name: 'University', baseCost: 8e11, costMultiplier: 1.19, cps: 6e8 }, b14: { name: 'Cathedral', baseCost: 5.2e12, costMultiplier: 1.19, cps: 3.5e9 }, b15: { name: 'Royal Palace', baseCost: 3.6e13, costMultiplier: 1.2, cps: 2.2e10 }, b16: { name: 'Kingdom', baseCost: 2.8e14, costMultiplier: 1.21, cps: 1.5e11 }, b17: { name: 'Empire', baseCost: 2.1e15, costMultiplier: 1.21, cps: 9e11 }, b18: { name: 'Senate', baseCost: 1.5e16, costMultiplier: 1.22, cps: 5.5e12 }, b19: { name: 'Colosseum', baseCost: 1.1e17, costMultiplier: 1.22, cps: 3e13 }, b20: { name: 'Grand Temple', baseCost: 8e17, costMultiplier: 1.23, cps: 1.8e14 },};
const highTierNames = [ 'Quantum Forge', 'Nebula Reactor', 'Stargate Hub', 'Galactic Exchange', 'Celestial Spire', 'Ethereal Nexus', 'Singularity Core', 'Hyperspace Beacon', 'Chrono-Synth Factory', 'Void Matter Extractor', 'Cosmic Oracle', 'Stellar Shipyard', 'Dimension Weaver', 'Reality Engine', 'Genesis Chamber', 'Omega Citadel', 'Astro-Observatory', 'Dark Matter Plant', 'Supernova Catalyst', 'Infinity Gate', 'Celestial Forge', 'Stardust Silo', 'Event Horizon Lab', 'Galaxy Brain Nexus', 'Time Dilation Spire', 'Reality Bender', 'The Omniverse', 'Finality Point', 'The Great Attractor', 'The Void' ];
let lastCps = BigInt('180000000000000'); let lastCost = BigInt('800000000000000000');
for (let i = 21; i <= 50; i++) { const cpsMultiplier = BigInt(Math.round((5 + i * 0.1) * 10)); const costMultiplier = BigInt(Math.round((6 + i * 0.15) * 100)); lastCps = (lastCps * cpsMultiplier) / 10n; lastCost = (lastCost * costMultiplier) / 100n; const name = highTierNames[i - 21] || `Cosmic Entity #${i - 20}`; KING_GAME_UPGRADES[`b${i}`] = { name: name, baseCost: lastCost, costMultiplier: 1.23 + (i * 0.002), cps: lastCps };}
const GEM_BOOSTS = { 'x2_coins': { name: '2x Coin Boost', cost: 10, duration_minutes: 60 }, 'half_cost': { name: '50% Upgrade Discount', cost: 5, duration_minutes: 5 },};
const COST_PER_HOUR = BigInt('77045760000');

// --- HELPER FUNCTIONS ---
const getUpgradeCost = (u, c, a) => { const r = KING_GAME_UPGRADES[u], t = BigInt(r.baseCost); let e = BigInt(Math.ceil(Number(t) * Math.pow(r.costMultiplier, c))); return a && a.half_cost && new Date(a.half_cost) > new Date && (e /= 2n), e };
const getUnitCost = (u, c, i) => { const t = i ? TROOPS_CONFIG[u] : DEFENSES_CONFIG[u]; return BigInt(Math.ceil(t.cost * Math.pow(t.costMultiplier, c))) };
const calculatePower = u => { let c = 0; const a = u.troops || {}, r = u.defenses || {}; for (const t in a) c += (a[t].level || 1) * TROOPS_CONFIG[t].power * (a[t].quantity || 0); for (const t in r) c += (r[t].level || 1) * DEFENSES_CONFIG[t].power * (r[t].quantity || 0); return BigInt(c) };
const calculateKingGameState = async (u, c) => { const a = u.king_game_upgrades || {}, r = u.active_boosts || {}, t = u => a[u] || 0; let e = 1n + BigInt(t("click") * (KING_GAME_UPGRADES.click?.value || 1)), o = 0n; for (const i in KING_GAME_UPGRADES) "click" !== i && (o += BigInt(t(i)) * BigInt(KING_GAME_UPGRADES[i].cps)); let s = Math.pow(2, u.prestige_level || 0), n = s; const l = RANKS_CONFIG.slice().reverse().find(c => u.power >= c.power) || RANKS_CONFIG[0]; n *= Math.pow(1.1, l.index); const g = c.findIndex(c => c.discord_id === u.discord_id); 0 === g && (n *= 1.5), 1 === g && (n *= 2); let p = e * BigInt(Math.round(n)), d = o * BigInt(Math.round(n)); return r.x2_coins && new Date(r.x2_coins) > new Date && (p *= 2n, d *= 2n), { clickValue: p.toString(), cps: d.toString(), power: u.power.toString(), rank: l.name } };

exports.handler = async function (event, context) {
    const cookies = event.headers?.cookie ? cookie.parse(event.headers.cookie) : {};
    const token = cookies.auth_token;
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    let decoded;
    try { decoded = jwt.verify(token, process.env.JWT_SECRET); } 
    catch (e) { return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) }; }
    const { id } = decoded;
    if (event.httpMethod === 'GET') { const action = event.queryStringParameters.action; if (action === 'get_users') { try { const { rows } = await db.query('SELECT discord_id, discord_username, power FROM users ORDER BY discord_username'); return { statusCode: 200, body: JSON.stringify(rows) }; } catch (error) { return { statusCode: 500, body: JSON.stringify({ error: 'Could not fetch user list.' }) }; } } try { const { rows } = await db.query('SELECT expires_at FROM keys WHERE owner_discord_id = $1 AND (key_type = \'perm\' OR (key_type = \'temp\' AND expires_at > NOW())) LIMIT 1', [id]); if (rows.length === 0) return { statusCode: 404, body: JSON.stringify({ error: 'You do not have an active key to play with.' }) }; return { statusCode: 200, body: JSON.stringify({ expires_at: rows[0].expires_at }) }; } catch (error) { return { statusCode: 500, body: JSON.stringify({ error: 'An internal server error occurred.' }) }; } }
    if (event.httpMethod === 'POST') {
        const body = JSON.parse(event.body);
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const userRes = await client.query('SELECT *, king_game_coins::text FROM users WHERE discord_id = $1 FOR UPDATE', [id]);
            if (userRes.rows.length === 0) throw new Error('User not found.');
            let user = userRes.rows[0];
            const topPlayersRes = await client.query('SELECT discord_id, power FROM users ORDER BY power DESC LIMIT 3');
            const topPlayers = topPlayersRes.rows;
            const now = new Date();
            let responseData = {};

            // --- NOUVELLE LOGIQUE DE RÉCOMPENSE QUOTIDIENNE ---
            const userPosition = topPlayers.findIndex(p => p.discord_id === id);
            if (userPosition !== -1) { // L'utilisateur est dans le Top 3
                const lastReward = user.last_daily_reward_at ? new Date(user.last_daily_reward_at) : null;
                // Vérifie si plus de 22 heures se sont écoulées (marge de sécurité)
                if (!lastReward || (now.getTime() - lastReward.getTime()) > 22 * 60 * 60 * 1000) {
                    let hoursToAdd = 0;
                    if (userPosition === 0) hoursToAdd = 3;      // Roi
                    else if (userPosition === 1) hoursToAdd = 2; // Reine
                    else if (userPosition === 2) hoursToAdd = 1; // Général

                    if (hoursToAdd > 0) {
                        const { rows: keyRows } = await client.query('SELECT id, expires_at FROM keys WHERE owner_discord_id = $1 AND key_type = \'temp\' AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1', [id]);
                        if (keyRows.length > 0) {
                            const currentExpiresAt = new Date(keyRows[0].expires_at);
                            const newExpiresAt = new Date(currentExpiresAt.getTime() + hoursToAdd * 3600 * 1000);
                            await client.query('UPDATE keys SET expires_at = $1 WHERE id = $2', [newExpiresAt, keyRows[0].id]);
                            user.last_daily_reward_at = now.toISOString(); // Mettre à jour la date de la récompense
                            
                            // Ajouter une notification pour l'interface
                            if (!responseData.notifications) responseData.notifications = [];
                            responseData.notifications.push(`Congratulations! As a top player, you've been awarded ${hoursToAdd} free hour(s) on your key!`);
                        }
                    }
                }
            }
            // --- FIN DE LA NOUVELLE LOGIQUE ---

            const lastUpdate = new Date(user.last_king_game_update);
            const secondsDiff = Math.floor((now - lastUpdate) / 1000);
            if (secondsDiff > 0) { const { cps } = await calculateKingGameState(user, topPlayers); user.king_game_coins = (BigInt(user.king_game_coins) + (BigInt(secondsDiff) * BigInt(cps))).toString(); }
            const { action } = body;
            let upgrades = user.king_game_upgrades || {}; let active_boosts = user.active_boosts || {}; let troops = user.troops || {}; let defenses = user.defenses || {};
            if (action === 'get_leaderboard') { const sortBy = body.sortBy || 'power'; let orderByClause; switch(sortBy) { case 'coins': orderByClause = 'king_game_coins::numeric DESC'; break; case 'prestige': orderByClause = 'prestige_level DESC, power DESC'; break; default: orderByClause = 'power DESC'; } const leaderboardRes = await client.query(`SELECT discord_username, power, king_game_coins::text, prestige_level FROM users ORDER BY ${orderByClause} LIMIT 50`); await client.query('ROLLBACK'); return { statusCode: 200, body: JSON.stringify(leaderboardRes.rows) }; }
            else if (action === 'send_coins') { const { recipientId, amount } = body; const amountBigInt = BigInt(amount); if (!recipientId || amountBigInt <= 0) throw new Error("Invalid recipient or amount."); if (recipientId === id) throw new Error("You cannot send coins to yourself."); if (BigInt(user.king_game_coins) < amountBigInt) throw new Error("Not enough coins to send."); user.king_game_coins = (BigInt(user.king_game_coins) - amountBigInt).toString(); await client.query("UPDATE users SET king_game_coins = king_game_coins::numeric + $1 WHERE discord_id = $2", [amount, recipientId]); }
            else if (action === 'click') { const { clickValue } = await calculateKingGameState(user, topPlayers); user.king_game_coins = (BigInt(user.king_game_coins) + BigInt(clickValue)).toString(); }
            else if (action === 'buy_upgrade') { const { upgradeId } = body; if (!KING_GAME_UPGRADES[upgradeId]) throw new Error('Invalid upgrade.'); const level = upgrades[upgradeId] || 0; const cost = getUpgradeCost(upgradeId, level, active_boosts); if (BigInt(user.king_game_coins) < cost) throw new Error("Not enough coins."); user.king_game_coins = (BigInt(user.king_game_coins) - cost).toString(); upgrades[upgradeId] = level + 1; }
            else if (action === 'prestige') { if ((user.prestige_level || 0) >= MAX_PRESTIGE_LEVEL) throw new Error("You have reached the maximum prestige level."); let canPrestige = true; for (const id in KING_GAME_UPGRADES) { if ((upgrades[id] || 0) < PRESTIGE_REQUIREMENT_LEVEL) { canPrestige = false; break; } } if (!canPrestige) throw new Error(`You must have all upgrades at level ${PRESTIGE_REQUIREMENT_LEVEL} to prestige.`); user.gems = (user.gems || 0) + 2; user.prestige_level = (user.prestige_level || 0) + 1; user.king_game_coins = '0'; upgrades = {}; active_boosts = {}; }
            else if (action === 'buy_boost') { const { boostId } = body; const boost = GEM_BOOSTS[boostId]; if (!boost) throw new Error('Invalid boost.'); if ((user.gems || 0) < boost.cost) throw new Error('Not enough gems.'); if (active_boosts[boostId] && new Date(active_boosts[boostId]) > now) throw new Error('This boost is already active.'); user.gems -= boost.cost; active_boosts[boostId] = new Date(now.getTime() + boost.duration_minutes * 60000).toISOString(); }
            else if (action === 'buy_time') { const hours = parseInt(body.hours, 10); if (!hours || hours <= 0 || hours > 168) throw new Error("Invalid number of hours."); const totalCost = COST_PER_HOUR * BigInt(hours); if (BigInt(user.king_game_coins) < totalCost) throw new Error("Not enough coins to buy time."); const { rows: keyRows } = await client.query('SELECT id, expires_at FROM keys WHERE owner_discord_id = $1 AND key_type = \'temp\' AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1', [id]); if (keyRows.length === 0) throw new Error("You do not have an active temporary key to extend."); user.king_game_coins = (BigInt(user.king_game_coins) - totalCost).toString(); const newExpiresAt = new Date(new Date(keyRows[0].expires_at).getTime() + hours * 3600000); await client.query('UPDATE keys SET expires_at = $1 WHERE id = $2', [newExpiresAt, keyRows[0].id]); responseData.newExpiresAt = newExpiresAt.toISOString(); }
            else if (action === 'buy_troop' || action === 'buy_defense') { const { unitId, quantity } = body; const isTroop = action === 'buy_troop'; const config = isTroop ? TROOPS_CONFIG[unitId] : DEFENSES_CONFIG[unitId]; const unitData = isTroop ? troops : defenses; if (!config || !quantity || quantity <= 0) throw new Error('Invalid unit or quantity.'); let totalCost = 0n; const currentQuantity = unitData[unitId]?.quantity || 0; for(let i=0; i<quantity; i++){ totalCost += getUnitCost(unitId, currentQuantity + i, isTroop); } if (BigInt(user.king_game_coins) < totalCost) throw new Error('Not enough coins.'); user.king_game_coins = (BigInt(user.king_game_coins) - totalCost).toString(); if (!unitData[unitId]) unitData[unitId] = { quantity: 0, level: 1 }; unitData[unitId].quantity += quantity; }
            else if (action === 'attack_player') { const { targetId } = body; if (!targetId || targetId === id) throw new Error('Invalid target.'); const lastAttacks = user.last_attack_timestamps || {}; if (lastAttacks[targetId] && (now.getTime() - new Date(lastAttacks[targetId]).getTime()) < 24 * 3600 * 1000) throw new Error('You can only attack this player once every 24 hours.'); if (topPlayers[1] && targetId === topPlayers[1].discord_id) throw new Error('The Queen is protected and cannot be attacked.'); const targetRes = await client.query('SELECT *, king_game_coins::text FROM users WHERE discord_id = $1 FOR UPDATE', [targetId]); if (targetRes.rows.length === 0) throw new Error('Target player not found.'); let targetUser = targetRes.rows[0]; let attackerPower = user.power; let defenderPower = targetUser.power; const attackerPos = topPlayers.findIndex(p => p.discord_id === id); const defenderPos = topPlayers.findIndex(p => p.discord_id === targetId); if (attackerPos === 0) attackerPower = attackerPower * 2n; if (attackerPos === 2) attackerPower = attackerPower * 15n / 10n; if (defenderPos === 0) defenderPower = defenderPower * 2n; if (defenderPos === 2) defenderPower = defenderPower * 15n / 10n; const attackerRoll = Number(attackerPower) * (Math.random() * 0.5 + 0.75); const defenderRoll = Number(defenderPower) * (Math.random() * 0.5 + 0.75); const attackerWins = attackerRoll > defenderRoll; const lossPercentWinner = 0.05; const lossPercentLoser = 0.20; const calculateLosses = (userTroops, lossPercent) => { for(const troopId in userTroops) { const losses = Math.ceil(userTroops[troopId].quantity * lossPercent); userTroops[troopId].quantity -= losses; if(userTroops[troopId].quantity < 0) userTroops[troopId].quantity = 0; } return userTroops; }; if (attackerWins) { const stolenAmount = BigInt(targetUser.king_game_coins) / 10n; user.king_game_coins = (BigInt(user.king_game_coins) + stolenAmount).toString(); targetUser.king_game_coins = (BigInt(targetUser.king_game_coins) - stolenAmount).toString(); user.troops = calculateLosses(troops, lossPercentWinner); targetUser.troops = calculateLosses(targetUser.troops, lossPercentLoser); if (defenderPos === 0) { user.power = BigInt(targetUser.power) + 1n; } responseData.battleReport = `Victory! You stole ${stolenAmount.toLocaleString('en-US')} coins.`; } else { user.troops = calculateLosses(troops, lossPercentLoser); targetUser.troops = calculateLosses(targetUser.troops, lossPercentWinner); responseData.battleReport = `Defeat! You lost the battle.`; } targetUser.power = calculatePower(targetUser); await client.query('UPDATE users SET king_game_coins = $1, troops = $2, power = $3 WHERE discord_id = $4', [targetUser.king_game_coins, JSON.stringify(targetUser.troops), targetUser.power.toString(), targetId]); lastAttacks[targetId] = now.toISOString(); user.last_attack_timestamps = lastAttacks; }
            
            user.power = calculatePower(user);
            await client.query( `UPDATE users SET king_game_coins = $1, king_game_upgrades = $2, last_king_game_update = $3, prestige_level = $4, gems = $5, active_boosts = $6, power = $7, troops = $8, defenses = $9, last_attack_timestamps = $10, last_daily_reward_at = $12 WHERE discord_id = $11`, [user.king_game_coins, JSON.stringify(upgrades), now.toISOString(), user.prestige_level || 0, user.gems || 0, JSON.stringify(active_boosts), user.power.toString(), JSON.stringify(troops), JSON.stringify(defenses), JSON.stringify(user.last_attack_timestamps || {}), id, user.last_daily_reward_at] );
            
            await client.query('COMMIT');

            const finalGameState = await calculateKingGameState(user, topPlayers);
            const finalResponse = {
                coins: user.king_game_coins, upgrades: upgrades, prestige_level: user.prestige_level || 0, gems: user.gems || 0,
                troops: troops, defenses: defenses, active_boosts: Object.fromEntries(Object.entries(active_boosts).filter(([_,exp]) => new Date(exp) > now)),
                power: finalGameState.power, rank: finalGameState.rank, cps: finalGameState.cps, clickValue: finalGameState.clickValue,
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
