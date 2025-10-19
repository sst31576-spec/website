// --- UTILITY FUNCTIONS ---
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

function formatTime(seconds) {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
}

function formatBigNumber(numStr) {
    try {
        if (typeof numStr !== 'string') numStr = numStr.toString();
        const num = BigInt(numStr);
        if (num < 1000) return num.toString();
        const suffixes = ['', 'k', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc'];
        const numString = num.toString();
        const i = Math.floor((numString.length - 1) / 3);
        if (i >= suffixes.length) return num.toExponential(2);
        const shortValue = (Number(num) / Math.pow(1000, i)).toFixed(2);
        return shortValue.replace(/\.00$/, '') + suffixes[i];
    } catch (e) {
        return "0";
    }
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
    const suggestionForm = document.getElementById('suggestion-form');
    const removeExpiredBtn = document.getElementById('remove-expired-btn');

    // --- GLOBAL STATE ---
    let currentUser = null;
    let allUsers = [];
    let gameState = {};
    let gameLoopInterval = null;
    let uiUpdateInterval = null;
    let selectedTarget = null;

    // --- GAME CONFIG (Must match backend) ---
    const MAX_REBIRTH_LEVEL = 10;
    const MAX_UPGRADE_LEVEL = 50;
    const MAX_TROOP_LEVEL = 5;

    const KING_GAME_UPGRADES = {
        click: { name: 'Royal Scepter', baseCost: 15, costMultiplier: 1.15, value: 1, description: 'Increases coins per click.' },
        b1: { name: 'Peasant Hut', baseCost: 100, costMultiplier: 1.1, cps: 1, description: 'Generates 1 coin/sec.' },
        b2: { name: 'Farm', baseCost: 1100, costMultiplier: 1.12, cps: 8, description: 'Generates 8 coins/sec.' },
        b3: { name: 'Castle', baseCost: 12000, costMultiplier: 1.14, cps: 45, description: 'Generates 45 coins/sec.' },
        b4: { name: 'Kingdom', baseCost: 130000, costMultiplier: 1.16, cps: 250, description: 'Generates 250 coins/sec.' },
        b5: { name: 'Empire', baseCost: 1.5e6, costMultiplier: 1.20, cps: 1400, description: 'Generates 1.4k coins/sec.' },
        b6: { name: 'Galaxy', baseCost: 20e6, costMultiplier: 1.25, cps: 7800, description: 'Generates 7.8k coins/sec.' },
        b7: { name: 'Universe', baseCost: 330e6, costMultiplier: 1.30, cps: 44000, description: 'Generates 44k coins/sec.' },
        c1: { name: 'Marketplace', baseCost: 5e9, costMultiplier: 1.28, cps: 260000, description: 'Generates 260k coins/sec.' },
        c2: { name: 'Bank', baseCost: 7.5e10, costMultiplier: 1.27, cps: 1.6e6, description: 'Generates 1.6M coins/sec.' },
        c3: { name: 'Library', baseCost: 1e12, costMultiplier: 1.26, cps: 9.5e6, description: 'Generates 9.5M coins/sec.' },
        c4: { name: 'University', baseCost: 1.4e13, costMultiplier: 1.25, cps: 5.8e7, description: 'Generates 58M coins/sec.' },
        c5: { name: 'Observatory', baseCost: 2e14, costMultiplier: 1.24, cps: 3.5e8, description: 'Generates 350M coins/sec.' },
        c6: { name: 'Space Elevator', baseCost: 3e15, costMultiplier: 1.23, cps: 2.1e9, description: 'Generates 2.1B coins/sec.' },
        c7: { name: 'Moon Base', baseCost: 4.5e16, costMultiplier: 1.22, cps: 1.3e10, description: 'Generates 13B coins/sec.' },
        c8: { name: 'Mars Colony', baseCost: 6.5e17, costMultiplier: 1.21, cps: 8e10, description: 'Generates 80B coins/sec.' },
        d1: { name: 'Asteroid Mine', baseCost: 9e18, costMultiplier: 1.20, cps: 5e11, description: 'Generates 500B coins/sec.' },
        d2: { name: 'Gas Giant Harvester', baseCost: 1.2e20, costMultiplier: 1.19, cps: 3.2e12, description: 'Generates 3.2T coins/sec.' },
        d3: { name: 'Interstellar Shipyard', baseCost: 1.6e21, costMultiplier: 1.18, cps: 2e13, description: 'Generates 20T coins/sec.' },
        d4: { name: 'Dyson Swarm', baseCost: 2.2e22, costMultiplier: 1.17, cps: 1.3e14, description: 'Generates 130T coins/sec.' },
        d5: { name: 'Matrioshka Brain', baseCost: 3e23, costMultiplier: 1.16, cps: 8.5e14, description: 'Generates 850T coins/sec.' },
        d6: { name: 'Stellar Engine', baseCost: 4e24, costMultiplier: 1.15, cps: 5.6e15, description: 'Generates 5.6Qa coins/sec.' },
        d7: { name: 'Black Hole Generator', baseCost: 5.5e25, costMultiplier: 1.14, cps: 3.8e16, description: 'Generates 38Qa coins/sec.' },
        d8: { name: 'Pocket Dimension', baseCost: 7.5e26, costMultiplier: 1.13, cps: 2.6e17, description: 'Generates 260Qa coins/sec.' },
        e1: { name: 'Reality Fabricator', baseCost: 1e28, costMultiplier: 1.12, cps: 1.8e18, description: 'Generates 1.8Qi coins/sec.' },
        e2: { name: 'Time Machine', baseCost: 1.5e29, costMultiplier: 1.11, cps: 1.2e19, description: 'Generates 12Qi coins/sec.' },
        e3: { name: 'Omniverse Portal', baseCost: 2.5e30, costMultiplier: 1.10, cps: 8e19, description: 'Generates 80Qi coins/sec.' },
    };
    const TROOPS = {
        squire: { name: 'Squire', cost: 10000, power: 50, training_time_seconds: 60, upgrade_cost_multiplier: 1 },
        swordsman: { name: 'Swordsman', cost: 50000, power: 250, training_time_seconds: 180, upgrade_cost_multiplier: 1.2 },
        spearman: { name: 'Spearman', cost: 75000, power: 375, training_time_seconds: 240, upgrade_cost_multiplier: 1.3 },
        archer: { name: 'Archer', cost: 100000, power: 500, training_time_seconds: 300, upgrade_cost_multiplier: 1.4 },
        cavalry: { name: 'Cavalry', cost: 250000, power: 1250, training_time_seconds: 600, upgrade_cost_multiplier: 2 },
        knight: { name: 'Knight', cost: 1e6, power: 5000, training_time_seconds: 1800, upgrade_cost_multiplier: 3 },
        royal_guard: { name: 'Royal Guard', cost: 5e6, power: 25000, training_time_seconds: 3600, perm_only: true, upgrade_cost_multiplier: 5 },
    };
    const GEM_BOOSTS = {
        'x2_coins': { name: '2x Coin Boost (1h)', cost: 10 },
        'half_cost': { name: '50% Upgrade Discount (5m)', cost: 5 },
    };

    // --- CORE APP FUNCTIONS ---
    const setupMobileNav = () => {
        const mainNav = document.querySelector('.top-bar-left nav');
        const mobileNavContainer = document.getElementById('mobile-nav-links');
        if (!mainNav || !mobileNavContainer || !dropdownMenu) return;
        mobileNavContainer.innerHTML = '';
        mainNav.querySelectorAll('a').forEach(link => {
            const clone = link.cloneNode(true);
            clone.addEventListener('click', (e) => {
                if (clone.dataset.page) {
                    e.preventDefault();
                    window.history.pushState({ page: clone.dataset.page }, '', `/${clone.dataset.page === 'home' ? '' : clone.dataset.page}`);
                    switchPage(clone.dataset.page);
                }
                dropdownMenu.classList.remove('show');
            });
            mobileNavContainer.appendChild(clone);
        });
    };

    const checkUserStatus = async () => {
        try {
            const response = await fetch('/api/user');
            if (response.status === 401) { showLoginView(); return; }
            if (response.status === 403) {
                showLoginView('You must join the Discord server.', 'https://discord.gg/RhDnUQr4Du');
                return;
            }
            if (!response.ok) throw new Error('Failed to fetch user data');
            currentUser = await response.json();
            setupMainApp(currentUser);
        } catch (error) {
            console.error(error);
            showLoginView('An error occurred. Please try again later.');
        }
    };

    const showLoginView = (message = null, discordLink = null) => {
        loginContainer.classList.remove('hidden');
        mainAppContainer.classList.add('hidden');
        if (loginError) {
            loginError.textContent = message;
            const parent = loginError.closest('.card-box');
            let existingBtn = document.getElementById('discord-join-btn');
            if(existingBtn) existingBtn.remove();
            
            if (message && discordLink) {
                const joinBtn = document.createElement('a');
                joinBtn.id = 'discord-join-btn';
                joinBtn.href = discordLink;
                joinBtn.target = '_blank';
                joinBtn.className = 'discord-btn';
                joinBtn.style.marginTop = '15px';
                joinBtn.textContent = 'Click to join the Discord';
                parent.appendChild(joinBtn);
            }
        }
    };

    const setupMainApp = (user) => {
        loginContainer.classList.add('hidden');
        mainAppContainer.classList.remove('hidden');
        userNameEl.textContent = user.discord_username;
        if (homeUserNameEl) homeUserNameEl.textContent = user.discord_username;
        userAvatarEl.src = user.discord_avatar || 'assets/logo.png';
        const displayStatus = user.isAdmin ? 'Admin' : user.user_status;
        userStatusBadgeEl.textContent = displayStatus;
        userStatusBadgeEl.className = 'status-badge ' + displayStatus.toLowerCase();
        if (user.isAdmin) manageKeysLink.classList.remove('hidden');
        handleRouting();
    };

    const switchPage = (pageId) => {
        if (gameLoopInterval) clearInterval(gameLoopInterval);
        if (uiUpdateInterval) clearInterval(uiUpdateInterval);
        gameLoopInterval = null;
        uiUpdateInterval = null;

        pages.forEach(page => page.classList.toggle('hidden', page.id !== `page-${pageId}`));
        navLinks.forEach(link => link.classList.toggle('active', link.dataset.page === pageId));
        
        if (pageId === 'get-key') renderGetKeyPage();
        if (pageId === 'manage-keys' && currentUser && currentUser.isAdmin) renderAdminPanel();
        if (pageId === 'earn-time') renderGamePage();
    };

    const handleRouting = () => {
        const path = window.location.pathname.replace(/\/$/, "");
        let pageId = 'home';
        if (path === '/get-key') pageId = 'get-key';
        if (path === '/suggestion') pageId = 'suggestion';
        if (path === '/manage-keys') pageId = 'manage-keys';
        if (path === '/earn-time') pageId = 'earn-time';
        
        if (pageId === 'home' && path !== '' && path !== '/') {
            window.history.replaceState({page: pageId}, '', '/');
        }
        switchPage(pageId);
    };

    // --- OTHER PAGE FUNCTIONS (Admin, Keys, etc.) ---
    const renderGetKeyPage = async () => { /* (Your original code remains here) */ };
    const handleGenerateKey = async (hash = null) => { /* (Your original code remains here) */ };
    const displayKey = (data) => { /* (Your original code remains here) */ };
    const handleResetHwid = async () => { /* (Your original code remains here) */ };
    const renderAdminPanel = async () => { /* (Your original code remains here) */ };
    const handleRemoveAllExpired = async () => { /* (Your original code remains here) */ };
    const handleDeleteKey = async (e) => { /* (Your original code remains here) */ };
    const handleEdit = async (e) => { /* (Your original code remains here) */ };

    // --- NEW GAME LOGIC ---

    async function sendGameAction(action, params = {}) {
        try {
            const response = await fetch('/api/earn-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...params }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'API action failed.');
            
            // Update local user state
            gameState.user = data.user;
            gameState.army = data.army;
            gameState.trainingQueue = data.trainingQueue;
            
            if (action === 'rebirth') alert(`Congratulations on reaching Rebirth Level ${data.user.rebirth_level}! You've earned gems and your journey starts anew with a permanent coin bonus.`);
            if (action === 'buy_boost') alert(`Boost purchased successfully!`);
            if (action === 'train_troops') alert(`Training started!`);
            if (action === 'upgrade_troop') alert(`Troop upgrade successful!`);
            if (action === 'convert_time') alert(`1 hour added to your key!`);
            
            updateAllUI();
            return data;
        } catch (error) {
            alert(`Error: ${error.message}`);
            // Force reload state on critical errors (like blocked/initial load issues)
            if (error.message.includes("blocked") || action === 'load') renderGamePage(); 
            throw error;
        }
    }

    function getUpgradeCost(upgradeId, level) {
        const upgrade = KING_GAME_UPGRADES[upgradeId];
        let cost = BigInt(Math.ceil(upgrade.baseCost * Math.pow(upgrade.costMultiplier, level)));
        if (gameState.user?.active_boosts?.['half_cost'] && new Date(gameState.user.active_boosts['half_cost']) > new Date()) {
            cost = cost / BigInt(2);
        }
        return cost;
    }

    function getTroopUpgradeCost(troopType, level) {
        const troop = TROOPS[troopType];
        const baseCost = troop.cost * 5; 
        return BigInt(Math.floor(baseCost * Math.pow(3, level) * troop.upgrade_cost_multiplier));
    }

    function calculateCPS() {
        if (!gameState.user) return 0;
        const { king_game_upgrades, rebirth_level, user_status, title, active_boosts } = gameState.user;
        const upgrades = king_game_upgrades || {};
        let cps = 0;
        for (const id in KING_GAME_UPGRADES) {
            if (id !== 'click') {
                cps += (upgrades[id] || 0) * KING_GAME_UPGRADES[id].cps;
            }
        }
        const rebirthBonus = 1 + (rebirth_level || 0) * 0.1;
        cps *= rebirthBonus;
        if (user_status === 'Perm') cps *= 2;
        if (title === 'Queen') cps *= 2;
        if (active_boosts?.['x2_coins'] && new Date(active_boosts['x2_coins']) > new Date()) {
            cps *= 2;
        }
        return Math.round(cps);
    }
    
    // --- UI RENDER FUNCTIONS ---
    function updateAllUI() {
        if (!document.getElementById('game-container') || !gameState.user) return;
        
        // Update main stats in header and game state
        gameState.user.king_game_coins = gameState.user.king_game_coins || '0';
        gameState.user.power = gameState.user.power || '0';
        
        updateEconomyUI();
        updateBarracksUI();
        updateBattleUI();
    }

    function updateEconomyUI() {
        const container = document.getElementById('tab-economy');
        if (!container || !container.classList.contains('active')) return;
        
        const { user } = gameState;
        const upgrades = user.king_game_upgrades || {};
        const rebirthBonus = 1 + (user.rebirth_level || 0) * 0.1;

        // Base structure render (only if not already built)
        if (!document.getElementById('upgrades-list')) {
             container.innerHTML = `
                <div class="economy-layout game-layout">
                    <div class="main-stats-panel panel-box">
                        <h4>Your Status</h4>
                        <div class="coin-display">
                            <p>Current Coins</p>
                            <h2 id="kg-coin-count">${formatBigNumber(user.king_game_coins)}</h2>
                            <p id="kg-cps-count">${formatBigNumber(calculateCPS())} coins/sec</p>
                            <p id="kg-perm-bonus" class="bonus-display title-king" style="${user.user_status === 'Perm' ? '' : 'display:none;'}">Permanent x2 Coin Bonus!</p>
                            <p id="kg-rebirth-bonus" class="bonus-display" style="${user.rebirth_level > 0 ? '' : 'display:none;'}">Rebirth Bonus: x${rebirthBonus.toFixed(2)}</p>
                            <p class="bonus-display" style="color: #72767d; margin-top: 10px;">Power: ${formatBigNumber(user.power)}</p>
                            <p id="player-title" class="player-title title-${user.title ? user.title.toLowerCase() : 'none'}">${user.title || 'Peasant'}</p>
                        </div>
                        <div class="clicker-area">
                            <button id="kg-clicker-btn">👑</button>
                        </div>
                    </div>

                    <div class="upgrades-panel panel-box">
                        <h4>Economic Upgrades (Max Lvl ${MAX_UPGRADE_LEVEL})</h4>
                        <div id="upgrades-list"></div>
                    </div>

                    <div class="actions-panel">
                        <div id="rebirth-section" class="panel-box">
                            <h4>Rebirth & Gems (💎 ${user.gems} | Lvl ${user.rebirth_level}/${MAX_REBIRTH_LEVEL})</h4>
                        </div>
                        <div id="gem-shop" class="panel-box">
                            <h4>Gem Shop</h4>
                        </div>
                        <div id="active-boosts" class="panel-box active-boosts-container">
                            <h4>Active Boosts</h4>
                        </div>
                        <div id="convert-time-section" class="panel-box" style="display: ${user.user_status === 'Perm' ? 'none' : 'block'};">
                            <h4>Convert Coins to Time</h4>
                            <p>Cost: ${formatBigNumber('100000000000')} coins for 1h</p>
                            <button id="kg-convert-btn" class="discord-btn">Convert</button>
                        </div>
                        <div id="send-coins-section" class="panel-box send-coins-container">
                            <h4>Send Coins</h4>
                             <div class="user-select-wrapper">
                                <input type="text" id="kg-recipient-search" placeholder="Search for a user...">
                                <div id="kg-recipient-dropdown" class="user-dropdown-content"></div>
                            </div>
                            <input type="number" id="kg-send-amount" placeholder="Amount" min="1">
                            <button id="kg-send-btn" class="secondary-btn">Send</button>
                        </div>
                    </div>
                </div>
            `;
            // Add initial listeners (only runs once)
            document.getElementById('kg-clicker-btn').addEventListener('click', (e) => {
                e.target.disabled = true;
                sendGameAction('click').finally(() => { e.target.disabled = false; });
            });
            if (document.getElementById('kg-convert-btn')) {
                document.getElementById('kg-convert-btn').addEventListener('click', () => sendGameAction('convert_time'));
            }

            // Setup user search functionality
            const searchInput = document.getElementById('kg-recipient-search');
            const dropdown = document.getElementById('kg-recipient-dropdown');
            let selectedUserId = null;
            searchInput.addEventListener('focus', () => { dropdown.style.display = 'block'; fetchUserList(); });
            searchInput.addEventListener('blur', () => setTimeout(() => dropdown.style.display = 'none', 150));
            searchInput.addEventListener('input', () => {
                const query = searchInput.value.toLowerCase();
                dropdown.innerHTML = '';
                const filteredUsers = allUsers.filter(u => u.discord_username.toLowerCase().includes(query) && u.discord_id !== user.discord_id);
                filteredUsers.slice(0, 10).forEach(u => {
                    const item = document.createElement('a');
                    item.textContent = u.discord_username;
                    item.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        searchInput.value = u.discord_username;
                        selectedUserId = u.discord_id;
                        dropdown.style.display = 'none';
                    });
                    dropdown.appendChild(item);
                });
            });
            document.getElementById('kg-send-btn').addEventListener('click', () => {
                const amount = document.getElementById('kg-send-amount').value;
                if (selectedUserId && amount > 0) {
                    sendGameAction('send_coins', { recipientId: selectedUserId, amount: amount });
                    selectedUserId = null;
                } else {
                    alert("Please select a valid user from the list and enter a positive amount.");
                }
            });
        }

        // --- DYNAMIC UPDATES ---
        
        // Update main counters
        document.getElementById('kg-coin-count').textContent = formatBigNumber(user.king_game_coins);
        document.getElementById('kg-cps-count').textContent = `${formatBigNumber(calculateCPS())} coins/sec`;
        document.getElementById('player-title').textContent = user.title || 'Peasant';
        document.getElementById('player-title').className = `player-title title-${user.title ? user.title.toLowerCase() : 'none'}`;

        const rebirthBonus = 1 + (user.rebirth_level || 0) * 0.1;
        document.getElementById('kg-rebirth-bonus').textContent = `Rebirth Bonus: x${rebirthBonus.toFixed(2)}`;

        // 1. Render Upgrades
        const upgradesContainer = document.getElementById('upgrades-list');
        let allMaxed = user.rebirth_level < MAX_REBIRTH_LEVEL;
        let upgradeHtml = '';
        for (const id in KING_GAME_UPGRADES) {
            const config = KING_GAME_UPGRADES[id];
            const level = (user.king_game_upgrades || {})[id] || 0;
            const isMax = level >= MAX_UPGRADE_LEVEL;
            if (!isMax) allMaxed = false;

            const cost = getUpgradeCost(id, level);
            const canAfford = BigInt(user.king_game_coins) >= cost;

            upgradeHtml += `
                <div class="upgrade-item">
                    <div class="upgrade-info">
                        <strong>${config.name} (Lvl ${level}/${MAX_UPGRADE_LEVEL})</strong>
                        <small class="desc">${config.description}</small>
                        <small>Cost: ${isMax ? 'MAXED' : formatBigNumber(cost.toString())}</small>
                    </div>
                    <button class="secondary-btn" data-upgrade-id="${id}" ${canAfford && !isMax ? '' : 'disabled'}>Buy</button>
                </div>
            `;
        }
        if (upgradesContainer.innerHTML !== upgradeHtml) {
            upgradesContainer.innerHTML = upgradeHtml;
            upgradesContainer.querySelectorAll('button').forEach(btn => btn.addEventListener('click', (e) => {
                e.target.disabled = true;
                sendGameAction('buy_upgrade', { upgradeId: e.target.dataset.upgradeId }).finally(() => { e.target.disabled = false; });
            }));
        }


        // 2. Render Rebirth Button
        const rebirthContainer = document.getElementById('rebirth-section');
        const rebirthBtn = document.getElementById('kg-rebirth-btn');
        document.querySelector('#rebirth-section h4').textContent = `Rebirth & Gems (💎 ${user.gems} | Lvl ${user.rebirth_level}/${MAX_REBIRTH_LEVEL})`;

        if (allMaxed && user.rebirth_level < MAX_REBIRTH_LEVEL) {
            if (!rebirthBtn) {
                rebirthContainer.innerHTML += `<button id="kg-rebirth-btn" class="discord-btn">Rebirth (Lvl ${user.rebirth_level + 1})</button>`;
                document.getElementById('kg-rebirth-btn').addEventListener('click', () => {
                    if (confirm(`Are you sure you want to rebirth? You will gain ${user.rebirth_level + 1} gems.`)) {
                        sendGameAction('rebirth');
                    }
                });
            } else {
                 rebirthBtn.textContent = `Rebirth (Lvl ${user.rebirth_level + 1})`;
            }
        } else {
            if (rebirthBtn) rebirthBtn.remove();
        }

        // 3. Render Gem Shop & Active Boosts
        const gemShopContainer = document.getElementById('gem-shop');
        let shopHtml = '';
        for (const id in GEM_BOOSTS) {
            const config = GEM_BOOSTS[id];
            const expiry = gameState.user.active_boosts?.[id];
            const isActive = expiry && new Date(expiry) > new Date();
            shopHtml += `<button class="secondary-btn" data-boost-id="${id}" ${isActive || user.gems < config.cost ? 'disabled' : ''}>${config.name} (${config.cost} Gems)</button>`;
        }
        if (gemShopContainer.innerHTML !== shopHtml) {
             gemShopContainer.innerHTML = shopHtml;
             gemShopContainer.querySelectorAll('button').forEach(btn => btn.addEventListener('click', (e) => {
                sendGameAction('buy_boost', { boostId: e.target.dataset.boostId });
             }));
        }

        const boostsContainer = document.getElementById('active-boosts');
        let hasActiveBoosts = false;
        let boostsHtml = '<h4>Active Boosts</h4>';
        for (const id in user.active_boosts) {
            const expiry = new Date(user.active_boosts[id]);
            if (expiry > new Date()) {
                hasActiveBoosts = true;
                const remaining = Math.ceil((expiry - new Date()) / 1000);
                const minutes = Math.floor(remaining / 60);
                const seconds = remaining % 60;
                boostsHtml += `<p>${GEM_BOOSTS[id].name.split('(')[0].trim()}: <strong>${minutes}m ${seconds.toString().padStart(2, '0')}s</strong></p>`;
            }
        }
        boostsContainer.innerHTML = boostsHtml;
        boostsContainer.style.display = hasActiveBoosts ? 'block' : 'none';
    }

    function updateBarracksUI() { 
        const container = document.getElementById('tab-barracks');
        if (!container || !container.classList.contains('active')) return;
        
        const { user, army, trainingQueue } = gameState;
        const troopLevels = army.troop_levels || {};

        if (!document.getElementById('troop-list')) {
            container.innerHTML = `
                <div class="barracks-layout game-layout">
                    <div class="my-army-panel panel-box">
                        <h4>Your Army (${formatBigNumber(user.power)} Power)</h4>
                        <div id="troop-list"></div>
                    </div>
                    <div class="training-panel panel-box">
                        <h4>Train Troops</h4>
                        <div id="training-queue" class="training-queue"></div>
                        <div id="training-options" class="training-options"></div>
                    </div>
                    <div class="defense-panel panel-box" style="grid-column: 1 / -1;">
                        <h4>Spy Defense (Lvl ${user.spy_defense_level})</h4>
                        <p>Cost to upgrade: ${formatBigNumber(Math.ceil(5000 * Math.pow(3, user.spy_defense_level)))} coins</p>
                        <button id="upgrade-spy-defense" class="secondary-btn" style="width: 100%;">Upgrade Spy Defense</button>
                    </div>
                </div>
            `;
            document.getElementById('upgrade-spy-defense').addEventListener('click', () => {
                sendGameAction('upgrade_spy_defense');
            });
        }
        
        // --- Dynamic Content ---
        const troopListContainer = document.getElementById('troop-list');
        let troopHtml = '';
        for (const id in TROOPS) {
            const config = TROOPS[id];
            const count = army[id] || 0;
            const level = troopLevels[id] || 0;
            const isMax = level >= MAX_TROOP_LEVEL;
            
            if (config.perm_only && user.user_status !== 'Perm') continue;

            const nextUpgradeCost = getTroopUpgradeCost(id, level);
            const canAffordUpgrade = BigInt(user.king_game_coins) >= nextUpgradeCost;

            troopHtml += `
                <div class="troop-item">
                    <div class="troop-stats">
                        <h5>${config.name} (x${formatBigNumber(count)})</h5>
                        <p>Power per unit: ${getTroopStat(id, level)}</p>
                        <p>Level: <span class="level-info">${level}/${MAX_TROOP_LEVEL}</span></p>
                    </div>
                    <div class="troop-actions">
                        <button class="secondary-btn" data-troop-type="${id}" data-action="upgrade" ${isMax || !canAffordUpgrade ? 'disabled' : ''}>
                            Upgrade (${isMax ? 'MAX' : formatBigNumber(nextUpgradeCost)})
                        </button>
                        <input type="number" id="train-${id}-qty" placeholder="Qty" min="1" value="1">
                        <button class="discord-btn" data-troop-type="${id}" data-action="train" ${trainingQueue ? 'disabled' : ''}>
                            Train (${formatBigNumber(config.cost)} ea)
                        </button>
                    </div>
                </div>
            `;
        }
        troopListContainer.innerHTML = troopHtml;
        
        // Troop listeners
        troopListContainer.querySelectorAll('button').forEach(btn => {
            const type = btn.dataset.troopType;
            if (btn.dataset.action === 'upgrade') {
                 btn.addEventListener('click', () => sendGameAction('upgrade_troop', { troopType: type }));
            } else if (btn.dataset.action === 'train') {
                 btn.addEventListener('click', () => {
                     const qty = parseInt(document.getElementById(`train-${type}-qty`).value);
                     if (qty > 0) sendGameAction('train_troops', { troopType: type, quantity: qty });
                 });
            }
        });

        // Training Queue
        const queueContainer = document.getElementById('training-queue');
        if (trainingQueue) {
            const finishTime = new Date(trainingQueue.finish_time);
            const remainingSeconds = Math.max(0, Math.floor((finishTime - new Date()) / 1000));
            queueContainer.innerHTML = `
                <h5>Training In Progress:</h5>
                <p>${formatBigNumber(trainingQueue.quantity)} ${TROOPS[trainingQueue.troop_type].name}(s)</p>
                <p>Time Left: <span class="timer">${formatTime(remainingSeconds)}</span></p>
            `;
            // Disable all train buttons when queue is active
            troopListContainer.querySelectorAll('[data-action="train"]').forEach(btn => btn.disabled = true);

        } else {
            queueContainer.innerHTML = '<h5>Training Queue:</h5><p class="finished-msg">Ready to train new troops!</p>';
        }

    }

    function updateBattleUI() {
        const container = document.getElementById('tab-battle');
        if (!container || !container.classList.contains('active')) return;
        
        const { user, leaderboard, battleReports } = gameState;

        if (!document.getElementById('leaderboard-list')) {
            container.innerHTML = `
                <div class="battle-layout game-layout">
                    <div class="leaderboard-panel panel-box">
                        <h4>Leaderboard (${user.title || 'Peasant'})</h4>
                        <div id="leaderboard-list"></div>
                    </div>
                    <div class="attack-panel panel-box">
                        <h4>Attack & Espionage</h4>
                        <div id="target-search-area">
                            <input type="text" id="target-search-input" placeholder="Search user to attack/spy">
                            <div id="target-search-dropdown" class="user-dropdown-content"></div>
                        </div>
                        <div id="target-info-display" class="target-info" style="display:none;"></div>
                        <div class="attack-actions">
                            <button id="spy-btn" class="secondary-btn" disabled>Spy (${formatBigNumber('1000')} coins)</button>
                            <button id="attack-btn" class="discord-btn" disabled>Attack</button>
                        </div>
                    </div>
                    <div class="reports-panel panel-box" style="grid-column: 1 / -1;">
                        <h4>Battle Reports</h4>
                        <div id="reports-list" class="battle-reports-list"></div>
                    </div>
                </div>
            `;
            fetchUserList();
            // Setup battle listeners here (Spy, Attack, Target Select)
        }
        
        // --- Dynamic Content ---
        
        // 1. Render Leaderboard
        const lbContainer = document.getElementById('leaderboard-list');
        let lbHtml = '';
        leaderboard.forEach((p, index) => {
            lbHtml += `
                <div class="leaderboard-item" data-user-id="${p.discord_id}">
                    <span class="rank">${index + 1}.</span>
                    <span class="name">${p.discord_username}</span>
                    <span class="power">${formatBigNumber(p.power)} Power</span>
                    <span class="title title-${p.title ? p.title.toLowerCase() : 'none'}">${p.title || ''}</span>
                </div>
            `;
        });
        lbContainer.innerHTML = lbHtml;

        // 2. Render Reports
        const reportsContainer = document.getElementById('reports-list');
        let reportsHtml = '';
        battleReports.forEach(r => {
            const isWin = r.winner_id === user.discord_id;
            const status = isWin ? 'WIN' : 'LOSS';
            reportsHtml += `
                <div class="report-item ${isWin ? 'win' : 'loss'}">
                    <strong>${status}</strong> against ${r.defender_name} (${formatTimeRemaining(r.report_time)})
                </div>
            `;
        });
        reportsContainer.innerHTML = reportsHtml || '<p class="text-muted">No recent reports.</p>';
    }

    // --- INITIAL GAME SETUP ---
    function startGame(initialState) {
        gameState = initialState;
        currentUser = initialState.user;

        if (gameLoopInterval) clearInterval(gameLoopInterval);
        gameLoopInterval = setInterval(() => {
            if (gameState.user) {
                const currentCoins = BigInt(gameState.user.king_game_coins);
                const cps = BigInt(calculateCPS());
                gameState.user.king_game_coins = (currentCoins + cps).toString();
            }
        }, 1000);

        if (uiUpdateInterval) clearInterval(uiUpdateInterval);
        uiUpdateInterval = setInterval(updateAllUI, 500);

        updateAllUI();
    }
    
    async function fetchUserList() {
        try {
            const response = await fetch('/api/earn-time?action=get_users');
            allUsers = await response.json();
        } catch(e) { console.error("Failed to fetch user list", e); }
    }


    async function renderGamePage() {
        const container = document.getElementById('earn-time-content');
        container.innerHTML = `<div class="card-box" style="max-width: 1200px;"><p>Loading your kingdom...</p></div>`;
        
        try {
            const response = await fetch('/api/earn-time');
            const initialState = await response.json();
            if (!response.ok) throw new Error(initialState.error);

            container.innerHTML = `
                <div id="game-container" class="card-box" style="max-width: 1200px;">
                    <div class="game-tabs">
                        <button class="tab-link active" data-tab="tab-economy">Kingdom</button>
                        <button class="tab-link" data-tab="tab-barracks">Barracks</button>
                        <button class="tab-link" data-tab="tab-battle">Battle</button>
                    </div>
                    <div id="tab-economy" class="tab-content active"></div>
                    <div id="tab-barracks" class="tab-content"></div>
                    <div id="tab-battle" class="tab-content"></div>
                </div>
            `;
            
            document.querySelectorAll('.tab-link').forEach(button => {
                button.addEventListener('click', () => {
                    document.querySelectorAll('.tab-link, .tab-content').forEach(el => el.classList.remove('active'));
                    button.classList.add('active');
                    document.getElementById(button.dataset.tab).classList.add('active');
                });
            });

            startGame(initialState);

        } catch (e) {
            container.innerHTML = `<div class="card-box" style="max-width: 1200px;"><p class="error-message">${e.message || 'Failed to load the game.'}</p></div>`;
        }
    }

    // --- EVENT LISTENERS ---
    if (suggestionForm) {
        suggestionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const statusEl = document.getElementById('suggestion-status');
            btn.disabled = true;
            btn.textContent = 'Sending...';
            try {
                const suggestionTextarea = document.getElementById('suggestion-textarea');
                const gameNameInput = document.getElementById('game-name-input');
                const gameLinkInput = document.getElementById('game-link-input');
                const suggestion = suggestionTextarea.value.trim();
                const gameName = gameNameInput.value.trim();
                const gameLink = gameLinkInput.value.trim();
                if (!suggestion || !gameName || !gameLink) throw new Error("Please fill all fields.");

                const response = await fetch('/api/send-suggestion', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ suggestion, gameName, gameLink }) 
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                
                statusEl.className = 'status-message success';
                statusEl.textContent = 'Suggestion sent!';
                suggestionForm.reset();
            } catch (error) {
                statusEl.className = 'status-message error';
                statusEl.textContent = error.message || 'Failed to send.';
            } finally {
                btn.disabled = false;
                btn.textContent = 'Send Suggestion';
            }
        });
    }
    if (removeExpiredBtn) {
        removeExpiredBtn.addEventListener('click', handleRemoveAllExpired);
    }
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const pageId = e.target.dataset.page;
            if (pageId) {
                e.preventDefault();
                window.history.pushState({ page: pageId }, '', `/${pageId === 'home' ? '' : pageId}`);
                switchPage(pageId);
            }
        });
    });
    if (manageKeysLink) {
        manageKeysLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.history.pushState({ page: 'manage-keys' }, '', '/manage-keys');
            switchPage('manage-keys');
            dropdownMenu.classList.remove('show');
        });
    }
    if (userProfileToggle) {
        userProfileToggle.addEventListener('click', () => dropdownMenu.classList.toggle('show'));
    }
    window.addEventListener('click', (e) => {
        if (userProfileToggle && !userProfileToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
            dropdownMenu.classList.remove('show');
        }
    });

    // --- INITIALIZATION ---
    setupMobileNav();
    checkUserStatus();
});
