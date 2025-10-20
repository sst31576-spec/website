function formatTimeRemaining(expiryDate) {
    if (!expiryDate) return 'N/A';
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diff = expiry - now;
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
}

// Custom BigInt formatter for large numbers
function formatBigNumber(num) {
    if (num === undefined || num === null) return '0';
    const numBigInt = typeof num === 'bigint' ? num : BigInt(num);
    if (numBigInt < 1000000) {
        return numBigInt.toLocaleString('en-US');
    }
    const suffixes = ['', 'K', 'M', 'B', 'T', 'q', 'Q', 's', 'S', 'o', 'n', 'd', 'ud', 'dd', 'td', 'qd', 'Qd', 'sd', 'Sd', 'od', 'nd'];
    const i = Math.floor((numBigInt.toString().length - 1) / 3);
    if (i >= suffixes.length) return numBigInt.toExponential(2);
    
    // Divide and format to 3 significant figures
    const divisor = BigInt('1' + '0'.repeat(i * 3));
    const value = parseFloat(numBigInt / divisor);

    let formattedValue;
    if (value >= 100) {
        formattedValue = value.toFixed(1);
    } else if (value >= 10) {
        formattedValue = value.toFixed(2);
    } else {
        formattedValue = value.toFixed(2);
    }
    
    return formattedValue.replace(/\.0+$/, '') + suffixes[i];
}


document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selection ---
    const loginContainer = document.getElementById('login-container');
    const mainAppContainer = document.getElementById('main-app');
    const loginError = document.getElementById('login-error-message');
    const userNameEl = document.getElementById('user-name');
    const homeUserNameEl = document.getElementById('home-username');
    const userAvatarEl = document.getElementById('user-avatar');
    const userStatusBadgeEl = document.getElementById('user-status-badge');
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');
    const userProfileToggle = document.getElementById('user-profile-toggle');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const manageKeysLink = document.getElementById('manage-keys-link');
    let currentUser = null;
    let allUsers = [];

    // --- GAME CONFIG (Must match backend) ---
    const PRESTIGE_REQUIREMENT_LEVEL = 75;
    const MAX_PRESTIGE_LEVEL = 20;
    const COST_PER_HOUR = BigInt('77045760000');

    const KING_GAME_UPGRADES_CONFIG = {
        click: { name: 'Royal Scepter', baseCost: 15, costMultiplier: 1.15, value: 1, description: 'Increases coins per click.' },
        b1: { name: 'Peasant Hut', baseCost: 100, costMultiplier: 1.1, cps: 1, description: 'Generates 1 coin/sec.' }, b2: { name: 'Farm', baseCost: 1100, costMultiplier: 1.12, cps: 8, description: 'Generates 8 coins/sec.' }, b3: { name: 'Bakery', baseCost: 8500, costMultiplier: 1.13, cps: 35, description: 'Generates 35 coins/sec.' }, b4: { name: 'Blacksmith', baseCost: 40000, costMultiplier: 1.13, cps: 150, description: 'Generates 150 coins/sec.' }, b5: { name: 'Market', baseCost: 210000, costMultiplier: 1.14, cps: 720, description: 'Generates 720 coins/sec.' }, b6: { name: 'Inn', baseCost: 1.4e6, costMultiplier: 1.15, cps: 3800, description: 'Generates 3.8K coins/sec.' }, b7: { name: 'Guard Tower', baseCost: 9e6, costMultiplier: 1.15, cps: 21000, description: 'Generates 21K coins/sec.' }, b8: { name: 'Church', baseCost: 5.5e7, costMultiplier: 1.16, cps: 115000, description: 'Generates 115K coins/sec.' }, b9: { name: 'Library', baseCost: 3.8e8, costMultiplier: 1.16, cps: 650000, description: 'Generates 650K coins/sec.' }, b10: { name: 'Town Hall', baseCost: 2.5e9, costMultiplier: 1.17, cps: 3.4e6, description: 'Generates 3.4M coins/sec.' }, b11: { name: 'Castle', baseCost: 1.8e10, costMultiplier: 1.18, cps: 2e7, description: 'Generates 20M coins/sec.' }, b12: { name: 'Barracks', baseCost: 1.2e11, costMultiplier: 1.18, cps: 1.1e8, description: 'Generates 110M coins/sec.' }, b13: { name: 'University', baseCost: 8e11, costMultiplier: 1.19, cps: 6e8, description: 'Generates 600M coins/sec.' }, b14: { name: 'Cathedral', baseCost: 5.2e12, costMultiplier: 1.19, cps: 3.5e9, description: 'Generates 3.5B coins/sec.' }, b15: { name: 'Royal Palace', baseCost: 3.6e13, costMultiplier: 1.2, cps: 2.2e10, description: 'Generates 22B coins/sec.' }, b16: { name: 'Kingdom', baseCost: 2.8e14, costMultiplier: 1.21, cps: 1.5e11, description: 'Generates 150B coins/sec.' }, b17: { name: 'Empire', baseCost: 2.1e15, costMultiplier: 1.21, cps: 9e11, description: 'Generates 900B coins/sec.' }, b18: { name: 'Senate', baseCost: 1.5e16, costMultiplier: 1.22, cps: 5.5e12, description: 'Generates 5.5T coins/sec.' }, b19: { name: 'Colosseum', baseCost: 1.1e17, costMultiplier: 1.22, cps: 3e13, description: 'Generates 30T coins/sec.' }, b20: { name: 'Grand Temple', baseCost: 8e17, costMultiplier: 1.23, cps: 1.8e14, description: 'Generates 180T coins/sec.' }
    };
    const highTierNames = [ 'Quantum Forge', 'Nebula Reactor', 'Stargate Hub', 'Galactic Exchange', 'Celestial Spire', 'Ethereal Nexus', 'Singularity Core', 'Hyperspace Beacon', 'Chrono-Synth Factory', 'Void Matter Extractor', 'Cosmic Oracle', 'Stellar Shipyard', 'Dimension Weaver', 'Reality Engine', 'Genesis Chamber', 'Omega Citadel', 'Astro-Observatory', 'Dark Matter Plant', 'Supernova Catalyst', 'Infinity Gate', 'Celestial Forge', 'Stardust Silo', 'Event Horizon Lab', 'Galaxy Brain Nexus', 'Time Dilation Spire', 'Reality Bender', 'The Omniverse', 'Finality Point', 'The Great Attractor', 'The Void' ];
    let lastCps = 1.8e14; let lastCost = 8e17;
    for (let i = 21; i <= 50; i++) {
        lastCps *= (5 + i * 0.1); lastCost *= (6 + i * 0.15);
        const name = highTierNames[i - 21] || `Cosmic Entity #${i - 20}`;
        KING_GAME_UPGRADES_CONFIG[`b${i}`] = { name: name, baseCost: lastCost, costMultiplier: 1.23 + (i * 0.002), cps: lastCps, description: `Generates ${formatBigNumber(Math.round(lastCps))} coins/sec.` };
    }
    const TROOPS_CONFIG = { 'warrior': { name: 'Warrior', cost: 10000, power: 10, costMultiplier: 1.05 }, 'archer': { name: 'Archer', cost: 50000, power: 45, costMultiplier: 1.06 }, 'knight': { name: 'Knight', cost: 250000, power: 220, costMultiplier: 1.07 }, 'mage': { name: 'Mage', cost: 1200000, power: 1100, costMultiplier: 1.08 }, 'dragon': { name: 'Dragon', cost: 8000000, power: 6500, costMultiplier: 1.1 },};
    const DEFENSES_CONFIG = { 'wall': { name: 'Wooden Wall', cost: 15000, power: 15, costMultiplier: 1.05 }, 'tower': { name: 'Watchtower', cost: 70000, power: 60, costMultiplier: 1.06 }, 'fortress': { name: 'Fortress', cost: 350000, power: 280, costMultiplier: 1.07 }, 'cannon': { name: 'Cannon', cost: 1800000, power: 1500, costMultiplier: 1.08 }, 'magic_shield': { name: 'Magic Shield', cost: 10000000, power: 8000, costMultiplier: 1.1 },};
    const GEM_BOOSTS_CONFIG = { 'x2_coins': { name: '2x Coin Boost (1h)', cost: 10 }, 'half_cost': { name: '50% Upgrade Discount (5m)', cost: 5 },};

    let kingGameState = { coins: BigInt(0), upgrades: {}, cps: BigInt(0), clickValue: BigInt(1), prestige_level: 0, gems: 0, troops: {}, defenses: {}, power: '0', rank: 'Unranked', active_boosts: {} };
    let kingGameInterval = null;
    let boostUpdateInterval = null;

    // --- Core App Functions (Login, Routing, etc. - unchanged) ---
    const setupMobileNav=()=>{const mainNav=document.querySelector(".top-bar-left nav"),mobileNavContainer=document.getElementById("mobile-nav-links");if(mainNav&&mobileNavContainer&&dropdownMenu){mobileNavContainer.innerHTML="",mainNav.querySelectorAll("a").forEach(link=>{const clone=link.cloneNode(!0);clone.addEventListener("click",e=>{clone.dataset.page&&(e.preventDefault(),window.history.pushState({page:clone.dataset.page},"",`/${"home"===clone.dataset.page?"":clone.dataset.page}`),switchPage(clone.dataset.page)),dropdownMenu.classList.remove("show")}),mobileNavContainer.appendChild(clone)})}};
    const checkUserStatus=async()=>{try{const response=await fetch("/api/user");if(401===response.status)return void showLoginView();if(403===response.status)return void showLoginView("You must join the Discord server.","https://discord.gg/RhDnUQr4Du");if(!response.ok)throw new Error("Failed to fetch user data");const user=await response.json();currentUser=user,setupMainApp(user)}catch(error){console.error(error),showLoginView("An error occurred. Please try again later.")}};
    const showLoginView=(message=null,discordLink=null)=>{loginContainer.classList.remove("hidden"),mainAppContainer.classList.add("hidden"),loginError&&(loginError.textContent=message,document.getElementById("discord-join-btn")?.remove(),message&&discordLink&&(()=>{const joinBtn=document.createElement("a");joinBtn.id="discord-join-btn",joinBtn.href=discordLink,joinBtn.target="_blank",joinBtn.className="discord-btn",joinBtn.style.marginTop="15px",joinBtn.textContent="Click to join the Discord",loginError.closest(".card-box").appendChild(joinBtn)})())};
    const setupMainApp=user=>{loginContainer.classList.add("hidden"),mainAppContainer.classList.remove("hidden"),userNameEl.textContent=user.discord_username,homeUserNameEl&&(homeUserNameEl.textContent=user.discord_username),userAvatarEl.src=user.discord_avatar||"assets/logo.png";const displayStatus=user.isAdmin?"Admin":user.user_status;userStatusBadgeEl.textContent=displayStatus,userStatusBadgeEl.className="status-badge "+displayStatus.toLowerCase(),user.isAdmin&&manageKeysLink.classList.remove("hidden"),handleRouting()};
    const switchPage=pageId=>{kingGameInterval&&clearInterval(kingGameInterval),boostUpdateInterval&&clearInterval(boostUpdateInterval),pages.forEach(page=>page.classList.toggle("hidden",page.id!==`page-${pageId}`)),navLinks.forEach(link=>link.classList.toggle("active",link.dataset.page===pageId)),"get-key"===pageId&&renderGetKeyPage(),"leaderboard"===pageId&&renderLeaderboardPage(),"manage-keys"===pageId&&currentUser?.isAdmin&&renderAdminPanel(),"earn-time"===pageId&&renderEarnTimePage()};
    const handleRouting=()=>{let path=window.location.pathname.replace(/\/$/,""),pageId="home";"/get-key"===path&&(pageId="get-key"),"/leaderboard"===path&&(pageId="leaderboard"),"/suggestion"===path&&(pageId="suggestion"),"/manage-keys"===path&&(pageId="manage-keys"),"/earn-time"===path&&(pageId="earn-time"),"home"===pageId&&""!==path&&"/"!==path&&window.history.replaceState({page:pageId},"", "/"),switchPage(pageId)};
    
    // --- Leaderboard Page ---
    const renderLeaderboardPage = () => {
        const container = document.getElementById('leaderboard-container');
        const controls = document.getElementById('leaderboard-controls');
        if (!container || !controls) return;
        
        const fetchAndDisplayLeaderboard = async (sortBy = 'power') => {
            container.innerHTML = '<p>Loading leaderboard...</p>';
            try {
                const response = await fetch('/api/earn-time', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'get_leaderboard', sortBy })
                });
                if (!response.ok) throw new Error('Failed to fetch leaderboard data.');
                const players = await response.json();

                controls.querySelectorAll('button').forEach(btn => btn.classList.toggle('active', btn.dataset.sort === sortBy));
                
                if (players.length === 0) {
                    container.innerHTML = '<p>No players to display.</p>';
                    return;
                }
                
                const table = document.createElement('table');
                table.className = 'leaderboard-table';
                table.innerHTML = `
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Player</th>
                            <th>Power</th>
                            <th>Coins</th>
                            <th>Prestige</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${players.map((p, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${p.discord_username}</td>
                                <td>${formatBigNumber(p.power)}</td>
                                <td>${formatBigNumber(p.king_game_coins)}</td>
                                <td>${p.prestige_level}</td>
                            </tr>
                        `).join('')}
                    </tbody>`;
                container.innerHTML = '';
                container.appendChild(table);
            } catch (error) {
                container.innerHTML = `<p class="error-message">${error.message}</p>`;
            }
        };

        controls.querySelectorAll('button').forEach(button => {
            button.onclick = () => fetchAndDisplayLeaderboard(button.dataset.sort);
        });

        fetchAndDisplayLeaderboard('power');
    };

    // --- King Clicker Game Functions ---
    const getUnitCost=(unitId,currentQuantity,isTroop)=>{const config=isTroop?TROOPS_CONFIG[unitId]:DEFENSES_CONFIG[unitId];return BigInt(Math.ceil(config.cost*Math.pow(config.costMultiplier,currentQuantity)))};
    const getUpgradeCost=(upgradeId,level)=>{const upgrade=KING_GAME_UPGRADES_CONFIG[upgradeId];let cost=BigInt(Math.ceil(upgrade.baseCost*Math.pow(upgrade.costMultiplier,level)));return kingGameState.active_boosts.half_cost&&new Date(kingGameState.active_boosts.half_cost)>new Date()&&(cost/=BigInt(2)),cost};

    const handleKingGameAction = async (action, params = {}) => {
        const payload = { action, ...params };
        try {
            const response = await fetch('/api/earn-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Game action failed.');
            
            kingGameState = { ...kingGameState, ...data, coins: BigInt(data.coins) };
            
            if (data.battleReport) alert(data.battleReport);
            if (action === 'prestige') alert(`Congratulations on reaching Prestige Level ${kingGameState.prestige_level}! You've earned 2 gems and your journey starts anew with a permanent coin bonus.`);
            if (action === 'buy_boost') alert(`Boost purchased successfully!`);
            if (action === 'send_coins') {
                 alert("Coins sent successfully!");
                 document.getElementById('kg-send-amount').value = '';
                 document.getElementById('kg-recipient-search').value = '';
            }
            if (action === 'buy_time' && data.newExpiresAt) {
                const hours = params.hours || 1;
                alert(`Successfully added ${hours} hour(s) to your key! It now expires on: ${new Date(data.newExpiresAt).toLocaleString()}`);
                if(!document.getElementById('page-get-key').classList.contains('hidden')) renderGetKeyPage();
            }
            updateKingGameUI();
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    };
    
    const updateKingGameUI = () => {
        if (!document.getElementById('king-game-container')) return;

        // Player Stats
        document.getElementById('kg-coin-count').textContent = formatBigNumber(kingGameState.coins);
        document.getElementById('kg-cps-count').textContent = `${formatBigNumber(kingGameState.cps)} coins/sec`;
        const prestige_bonus = Math.pow(2, kingGameState.prestige_level || 0);
        const bonusEl = document.getElementById('kg-bonus-display');
        bonusEl.textContent = `Prestige Bonus: x${prestige_bonus.toLocaleString('en-US')}`;
        bonusEl.style.display = kingGameState.prestige_level > 0 ? 'block' : 'none';
        document.getElementById('kg-player-power').textContent = formatBigNumber(kingGameState.power);
        document.getElementById('kg-player-rank').textContent = kingGameState.rank;
        document.getElementById('kg-gem-count').textContent = `${kingGameState.gems || 0} Gems`;
        
        const renderList=(containerEl,config,isBuilding,isTroop)=>{containerEl.innerHTML="";let allMaxed=!0;for(const id in config){const itemConfig=config[id];let level,cost,quantity;if(isBuilding){level=kingGameState.upgrades[id]||0;if(level<PRESTIGE_REQUIREMENT_LEVEL)allMaxed=!1;cost=getUpgradeCost(id,level)}else{const unitData=(isTroop?kingGameState.troops:kingGameState.defenses)[id];quantity=unitData?.quantity||0;cost=getUnitCost(id,quantity,isTroop)}const item=document.createElement("div");item.className="upgrade-item";item.innerHTML=`\n                <div class="upgrade-info">\n                    <strong>${itemConfig.name} ${isBuilding?`(Lvl ${level})`:`(x${quantity})`}</strong>\n                    <small class="desc">${isBuilding?itemConfig.description:`Power: ${itemConfig.power}`}</small>\n                    <small>Cost: ${formatBigNumber(cost)}</small>\n                </div>\n                <button class="secondary-btn" data-id="${id}" ${kingGameState.coins<cost?"disabled":""}>Buy</button>\n            `;item.querySelector("button").addEventListener("click",e=>{const unitId=e.target.dataset.id;if(isBuilding)handleKingGameAction("buy_upgrade",{upgradeId:unitId});else{const quantity=e.shiftKey?100:e.ctrlKey?10:1;handleKingGameAction(isTroop?"buy_troop":"buy_defense",{unitId:unitId,quantity:quantity})}}),containerEl.appendChild(item)}return allMaxed};
        
        // Render all lists
        const allMaxed = renderList(document.getElementById('kg-upgrades-list'), KING_GAME_UPGRADES_CONFIG, true, false);
        renderList(document.getElementById('kg-army-list'), TROOPS_CONFIG, false, true);
        renderList(document.getElementById('kg-defenses-list'), DEFENSES_CONFIG, false, false);
        
        // Gem Shop
        const gemShopContainer=document.getElementById("kg-gem-shop");gemShopContainer.innerHTML="";for(const id in GEM_BOOSTS_CONFIG){const config=GEM_BOOSTS_CONFIG[id],isActive=kingGameState.active_boosts[id]&&new Date(kingGameState.active_boosts[id])>new Date(),btn=document.createElement("button");btn.className="secondary-btn",btn.textContent=`${config.name} (${config.cost} Gems)`,btn.disabled=isActive||kingGameState.gems<config.cost,btn.addEventListener("click",()=>handleKingGameAction("buy_boost",{boostId:id})),gemShopContainer.appendChild(btn)}

        // Prestige Button
        const prestigeContainer=document.getElementById("kg-prestige-container");allMaxed&&kingGameState.prestige_level<MAX_PRESTIGE_LEVEL?(prestigeContainer.innerHTML=`<button id="kg-prestige-btn" class="discord-btn">Prestige (Level ${kingGameState.prestige_level+1})</button>`,prestigeContainer.querySelector("#kg-prestige-btn").addEventListener("click",()=>{confirm("Are you sure you want to prestige? This will reset your coins and building levels for a permanent x2 coin multiplier and 2 gems!")&&handleKingGameAction("prestige")})):kingGameState.prestige_level>=MAX_PRESTIGE_LEVEL?prestigeContainer.innerHTML='<p class="max-prestige-msg">You have reached the max prestige level!</p>':prestigeContainer.innerHTML=`<p class="text-muted">Reach Lvl ${PRESTIGE_REQUIREMENT_LEVEL} on all buildings to prestige.</p>`;
    };
    
    const fetchUserList = async () => {
        try {
            const response = await fetch('/api/earn-time?action=get_users');
            allUsers = await response.json();
        } catch(e) { console.error("Failed to fetch user list", e); }
    };
    
    const renderKingGame = () => {
        const container = document.getElementById('earn-time-content');
        container.innerHTML = `
            <div id="king-game-container" class="king-game-layout">
                <div class="kg-left-panel">
                    <div class="coin-display">
                        <h2 id="kg-coin-count">0</h2>
                        <p id="kg-cps-count">0 coins/sec</p>
                        <p id="kg-bonus-display" style="display: none;"></p>
                    </div>
                    <div class="clicker-area"><button id="kg-clicker-btn">👑</button></div>
                    <div id="kg-player-stats">
                        <h4>Your Stats</h4>
                        <p><strong>Power:</strong> <span id="kg-player-power">0</span></p>
                        <p><strong>Rank:</strong> <span id="kg-player-rank">Unranked</span></p>
                    </div>
                    <div class="shop-container">
                         <h4>Gem Shop (<span id="kg-gem-count">0</span>)</h4>
                         <div id="kg-gem-shop"></div>
                    </div>
                </div>
                <div class="kg-middle-panel"><div class="upgrades-container"><h4>Buildings</h4><div id="kg-upgrades-list"></div></div></div>
                <div class="kg-right-panel"><div class="army-container"><h4>Army</h4><div id="kg-army-list"></div></div><div class="defense-container"><h4>Defenses</h4><div id="kg-defenses-list"></div></div></div>
                <div class="kg-bottom-panel">
                    <div id="kg-buy-time-container" class="kg-buy-time-container">
                        <select id="kg-buy-time-select"><option value="1">1 Hour</option><option value="6">6 Hours</option><option value="12">12 Hours</option><option value="24">24 Hours</option></select>
                        <button id="kg-buy-time-btn" class="secondary-btn" disabled>Buy Time</button><small id="kg-buy-time-cost-display">Cost: ...</small>
                    </div>
                    <div class="send-coins-container"><h4>Send Coins</h4><div class="user-select-wrapper"><input type="text" id="kg-recipient-search" placeholder="Player name..."><div id="kg-recipient-dropdown" class="user-dropdown-content"></div></div><input type="number" id="kg-send-amount" placeholder="Amount" min="1"><button id="kg-send-btn" class="secondary-btn">Send</button></div>
                    <div id="kg-prestige-container"></div>
                    <div class="attack-container"><h4>Attack</h4><div class="user-select-wrapper"><input type="text" id="kg-attack-target-search" placeholder="Player name..."><div id="kg-attack-target-dropdown" class="user-dropdown-content"></div></div><button id="kg-attack-btn" class="secondary-btn-red">Attack</button></div>
                </div>
            </div>`;

        if (currentUser?.user_status === 'Perm') {
            document.getElementById('kg-buy-time-container')?.classList.add('hidden');
        }
        
        // Event Listeners
        document.getElementById('kg-clicker-btn').addEventListener('click', () => handleKingGameAction('click'));
        const buyTimeSelect = document.getElementById('kg-buy-time-select');
        const buyTimeCostDisplay = document.getElementById('kg-buy-time-cost-display');
        const updateCostDisplay = () => {
            if (!buyTimeSelect || !buyTimeCostDisplay) return;
            const hours = parseInt(buyTimeSelect.value, 10);
            const cost = COST_PER_HOUR * BigInt(hours);
            buyTimeCostDisplay.textContent = `Cost: ${formatBigNumber(cost)}`;
        };
        if(buyTimeSelect) {
            buyTimeSelect.addEventListener('change', updateCostDisplay);
            document.getElementById('kg-buy-time-btn').addEventListener('click', () => {
                const hours = parseInt(buyTimeSelect.value, 10);
                const cost = COST_PER_HOUR * BigInt(hours);
                if (confirm(`Are you sure you want to spend ${formatBigNumber(cost)} coins to add ${hours} hour(s) to your key?`)) {
                    handleKingGameAction('buy_time', { hours: hours });
                }
            });
            updateCostDisplay();
        }
        
        // Setup User Search Dropdowns
        const setupUserSearch=(inputId,dropdownId,onSelect,showPower)=>{const searchInput=document.getElementById(inputId),dropdown=document.getElementById(dropdownId);let selectedUserId=null;const updateDropdown=()=>{const query=searchInput.value.toLowerCase();dropdown.innerHTML="";const filteredUsers=allUsers.filter(u=>u.discord_username.toLowerCase().includes(query)&&u.discord_id!==currentUser.discord_id);dropdown.style.display=filteredUsers.length>0?"block":"none";filteredUsers.slice(0,5).forEach(user=>{const item=document.createElement("a");item.innerHTML=`<span>${user.discord_username}</span>`+(showPower?`<span class="power">⚡ ${formatBigNumber(user.power)}</span>`:"");item.addEventListener("mousedown",()=>{searchInput.value=user.discord_username,selectedUserId=user.discord_id,dropdown.style.display="none",onSelect(selectedUserId,searchInput)})})};searchInput.addEventListener("focus",updateDropdown),searchInput.addEventListener("blur",()=>setTimeout(()=>dropdown.style.display="none",150)),searchInput.addEventListener("input",updateDropdown)};
        
        let sendRecipientId = null;
        let attackTargetId = null;
        setupUserSearch('kg-recipient-search', 'kg-recipient-dropdown', (id) => { sendRecipientId = id; }, false);
        setupUserSearch('kg-attack-target-search', 'kg-attack-target-dropdown', (id) => { attackTargetId = id; }, true);

        document.getElementById('kg-send-btn').addEventListener('click', () => {
            const amount = document.getElementById('kg-send-amount').value;
            if (sendRecipientId && amount > 0) handleKingGameAction('send_coins', { recipientId: sendRecipientId, amount });
            else alert("Please select a valid user and enter a positive amount.");
        });
        document.getElementById('kg-attack-btn').addEventListener('click', () => {
            if (attackTargetId) handleKingGameAction('attack_player', { targetId: attackTargetId });
            else alert("Please select a valid player to attack.");
        });
        
        fetchUserList();
        
        if (kingGameInterval) clearInterval(kingGameInterval);
        kingGameInterval = setInterval(() => {
            if (!document.getElementById('king-game-container')) return clearInterval(kingGameInterval);
            kingGameState.coins += kingGameState.cps;
            updateKingGameUI();
        }, 1000);

        handleKingGameAction('load');
    };

    const renderEarnTimePage = async () => {
        const container = document.getElementById('earn-time-content');
        if (!container || !currentUser) return;
        container.innerHTML = '<p>Loading your empire...</p>';
        try {
            await fetch('/api/earn-time');
            renderKingGame();
        } catch (error) {
            container.innerHTML = `<p class="error-message">Could not load game data. Only users with an active key can play.</p><a href="/get-key" class="discord-btn" style="margin-top: 15px;">Get a Key</a>`;
        }
    };
    
    // --- Global Event Listeners (unchanged) ---
    navLinks.forEach(link=>{link.addEventListener("click",e=>{const pageId=e.target.dataset.page;pageId&&(e.preventDefault(),window.history.pushState({page:pageId},"",`/${"home"===pageId?"":pageId}`),switchPage(pageId))})}),manageKeysLink&&manageKeysLink.addEventListener("click",e=>{e.preventDefault(),window.history.pushState({page:"manage-keys"},"","/manage-keys"),switchPage("manage-keys"),dropdownMenu.classList.remove("show")}),userProfileToggle&&userProfileToggle.addEventListener("click",()=>dropdownMenu.classList.toggle("show")),window.addEventListener("click",e=>{userProfileToggle&&!userProfileToggle.contains(e.target)&&!dropdownMenu.contains(e.target)&&dropdownMenu.classList.remove("show")});

    // --- Initialization ---
    setupMobileNav();
    checkUserStatus();
});
