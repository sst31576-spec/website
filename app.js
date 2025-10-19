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
    const setupMobileNav = () => { /* (Your original code remains here) */ };
    const checkUserStatus = async () => { /* (Your original code remains here) */ };
    const showLoginView = (message = null, discordLink = null) => { /* (Your original code remains here) */ };
    const setupMainApp = (user) => { /* (Your original code remains here) */ };
    const handleRouting = () => { /* (Your original code remains here) */ };

    // --- SWITCH PAGE (Modified) ---
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

    // --- OTHER PAGE FUNCTIONS (Admin, Keys, etc.) ---
    const renderGetKeyPage = async () => {
        const container = document.getElementById('key-generation-content');
        if (!container || !currentUser) return;
        container.innerHTML = `<p>Checking for an existing key...</p>`;
        try {
            const response = await fetch('/api/generate-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await response.json();
            if (response.ok) {
                displayKey(data);
                return;
            }

            const urlParams = new URLSearchParams(window.location.search);
            const hash = urlParams.get('hash');
            if (hash) {
                container.innerHTML = `
                    <p>Thank you! You can now get your key.</p>
                    <button id="generate-key-btn" class="discord-btn">Get Key</button>
                    <div id="key-display-area" class="hidden"></div>
                    <div id="generate-error" class="error-message" style="margin-top: 8px;"></div>
                `;
                document.getElementById('generate-key-btn').addEventListener('click', () => handleGenerateKey(hash));
            } else {
                container.innerHTML = `
                    <p>To get your 12-hour key, please complete the task below.</p>
                    <a href="https://link-hub.net/1409420/j5AokQm937Cf" class="discord-btn">Start Task</a>
                    <p class="text-muted" style="margin-top: 1rem; font-size: 14px;">After completing the task, you will be redirected back here to claim your key.</p>
                `;
            }
        } catch (error) {
            console.error(error);
            container.innerHTML = `<p class="error-message">${error.message}</p>`;
        }
    };
    const handleGenerateKey = async (hash = null) => {
        const btn = document.getElementById('generate-key-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Generating...';
        }
        const errorEl = document.getElementById('generate-error');
        if (errorEl) errorEl.textContent = '';

        try {
            const response = await fetch('/api/generate-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(hash ? { hash } : {})
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not generate key.');
            displayKey(data);
        } catch (error) {
            if (errorEl) errorEl.textContent = error.message;
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Get Key';
            }
        }
    };
    const displayKey = (data) => {
        const container = document.getElementById('key-generation-content');
        if (!container) return;
        
        container.innerHTML = `
            <div id="key-display-area">
                <h4>Your key is ready:</h4>
                <div class="key-container">
                    <input type="text" value="${data.key}" readonly id="generated-key-input" />
                    <button id="copy-key-btn" class="secondary-btn">Copy</button>
                </div>
                <button id="get-script-btn" class="discord-btn">Get Script</button>
                <button id="reset-hwid-btn" class="secondary-btn">Reset HWID (24h Cooldown)</button>
                <div id="hwid-status" class="status-message"></div>
                ${data.type === 'temp' ? `<p>Expires in: <strong>${formatTimeRemaining(data.expires)}</strong></p>` : ''}
            </div>
        `;
        
        document.getElementById('copy-key-btn').addEventListener('click', () => {
            const input = document.getElementById('generated-key-input');
            const btn = document.getElementById('copy-key-btn');
            input.select();
            document.execCommand('copy');
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        });
        
        document.getElementById('get-script-btn').addEventListener('click', (e) => {
            const scriptToCopy = 'loadstring(game:HttpGet("https://raw.githubusercontent.com/DoggyKing/king-gen-hub/refs/heads/main/keyhub",true))()';
            const btn = e.target;
            navigator.clipboard.writeText(scriptToCopy).then(() => {
                btn.textContent = 'Copied!';
                btn.style.backgroundColor = 'var(--brand-green)';
                setTimeout(() => {
                    btn.textContent = 'Get Script';
                    btn.style.backgroundColor = 'var(--brand-blue)';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy script: ', err);
                btn.textContent = 'Error';
                btn.style.backgroundColor = 'var(--brand-red)';
                 setTimeout(() => {
                    btn.textContent = 'Get Script';
                    btn.style.backgroundColor = 'var(--brand-blue)';
                }, 2000);
            });
        });

        document.getElementById('reset-hwid-btn').addEventListener('click', handleResetHwid);
    };
    const handleResetHwid = async () => {
        const btn = document.getElementById('reset-hwid-btn');
        const statusEl = document.getElementById('hwid-status');
        if (!btn || !statusEl) return;
        btn.disabled = true;
        statusEl.textContent = 'Resetting...';
        try {
            const response = await fetch('/api/reset-hwid', { method: 'POST' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            statusEl.className = 'status-message success';
            statusEl.textContent = result.message;
        } catch (error) {
            statusEl.className = 'status-message error';
            statusEl.textContent = error.message || 'Failed to reset HWID.';
        } finally {
            setTimeout(() => { btn.disabled = false; }, 2000);
        }
    };
    const renderAdminPanel = async () => {
        const container = document.getElementById('admin-key-list');
        const searchInput = document.getElementById('admin-search-input');
        if (!container || !searchInput) return;

        container.innerHTML = '<p>Loading keys...</p>';
        try {
            const response = await fetch('/api/admin/keys');
            if (!response.ok) throw new Error('Failed to fetch keys.');
            const keys = await response.json();
            
            container.innerHTML = '';
            
            const table = document.createElement('table');
            table.className = 'admin-table';
            table.innerHTML = `<thead><tr><th>Key</th><th>Type</th><th>Owner</th><th>HWID (Roblox ID)</th><th>Expires In</th><th>Action</th></tr></thead><tbody></tbody>`;
            container.appendChild(table);
            const tbody = table.querySelector('tbody');
            
            tbody.innerHTML = keys.length === 0 ? '<tr><td colspan="6" style="text-align: center;">No keys found.</td></tr>' : keys.map(key => `
                <tr data-key-id="${key.id}" data-key-type="${key.key_type}" data-expires-at="${key.expires_at || ''}">
                    <td class="key-value">${key.key_value}</td>
                    <td><span class="key-badge ${key.key_type}">${key.key_type}</span></td> 
                    <td class="owner-name">${key.discord_username || 'N/A'}</td>
                    <td class="hwid-cell editable">${key.roblox_user_id || 'Not Set'}</td>
                    <td class="expires-cell editable">${key.key_type === 'temp' ? formatTimeRemaining(key.expires_at) : 'N/A'}</td>
                    <td class="actions-cell"><button class="delete-key-btn secondary-btn-red">Delete</button></td>
                </tr>`).join('');
            
            const tableRows = container.querySelectorAll('tbody tr');
            searchInput.oninput = () => {
                const searchTerm = searchInput.value.toLowerCase();
                tableRows.forEach(row => {
                    const keyValue = row.querySelector('.key-value').textContent.toLowerCase();
                    const ownerName = row.querySelector('.owner-name').textContent.toLowerCase();
                    row.style.display = (keyValue.includes(searchTerm) || ownerName.includes(searchTerm)) ? '' : 'none';
                });
            };
            
            container.querySelectorAll('.delete-key-btn').forEach(btn => btn.addEventListener('click', handleDeleteKey));
            container.querySelectorAll('.hwid-cell.editable').forEach(cell => cell.addEventListener('click', handleEdit));
            container.querySelectorAll('.expires-cell.editable').forEach(cell => cell.addEventListener('click', handleEdit));
        } catch (error) {
            container.innerHTML = `<p class="error-message">${error.message}</p>`;
        }
    };
    const handleRemoveAllExpired = async () => {
        if (!confirm('Are you sure you want to delete ALL expired keys? This action cannot be undone.')) return;
        removeExpiredBtn.disabled = true;
        removeExpiredBtn.textContent = 'Deleting...';
        try {
            const response = await fetch('/api/admin/keys', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete_expired' })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to delete expired keys.');
            alert(result.message);
            renderAdminPanel();
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            removeExpiredBtn.disabled = false;
            removeExpiredBtn.textContent = 'Remove All Expired';
        }
    };
    const handleDeleteKey = async (e) => {
        const row = e.target.closest('tr');
        const keyId = row.dataset.keyId;
        if (confirm('Are you sure you want to delete this key permanently?')) {
            try {
                const response = await fetch('/api/admin/keys', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key_id: keyId }) });
                if (!response.ok) throw new Error('Failed to delete.');
                row.remove();
            } catch (error) { alert('Error deleting key.'); }
        }
    };
    const handleEdit = async (e) => {
        const cell = e.target;
        const row = cell.closest('tr');
        const keyId = row.dataset.keyId;
        const keyType = row.dataset.keyType; 
        const isHwid = cell.classList.contains('hwid-cell');
        const isExpires = cell.classList.contains('expires-cell');
        
        if (isExpires && keyType.toLowerCase() !== 'temp') {
            alert("Only 'temp' keys can have their expiration date modified.");
            return;
        }

        let newHwid = undefined;
        let newExpiresAt = undefined;

        if (isHwid) {
            const currentHwid = cell.textContent.trim() === 'Not Set' ? '' : cell.textContent.trim();
            const result = prompt('Enter the new Roblox User ID (leave blank to clear HWID):', currentHwid);
            if (result === null) return; 
            newHwid = result.trim();
        } else if (isExpires) {
            const result = prompt('Enter the time to ADD to the key (e.g., "24h" for 24 hours, "90m" for 90 minutes, or "clear" to remove expiry):', '12h');
            if (result === null) return; 
            const input = result.trim().toLowerCase();
            
            if (input === 'clear') {
                newExpiresAt = null;
            } else {
                const parseDuration = (str) => {
                    const matchHours = str.match(/(\d+)h/);
                    const matchMinutes = str.match(/(\d+)m/);
                    let ms = 0;
                    if (matchHours) ms += parseInt(matchHours[1]) * 3600000;
                    if (matchMinutes) ms += parseInt(matchMinutes[1]) * 60000;
                    return ms;
                };
                const durationMs = parseDuration(input);
                if (durationMs > 0) {
                    newExpiresAt = new Date(Date.now() + durationMs).toISOString();
                } else {
                    alert('Invalid format. Use "24h", "90m", or "clear".');
                    return;
                }
            }
        }
        
        if (newHwid === undefined && newExpiresAt === undefined) return;
        
        try {
            cell.classList.add('loading');
            const payload = { key_id: keyId };
            if (newHwid !== undefined) payload.new_roblox_user_id = newHwid;
            if (newExpiresAt !== undefined) payload.new_expires_at = newExpiresAt;

            const response = await fetch('/api/admin/keys', { 
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(payload) 
            });
            if (!response.ok) throw new Error('Failed to update.');
            
            if (newHwid !== undefined) {
                cell.textContent = newHwid === '' ? 'Not Set' : newHwid;
            }
            if (newExpiresAt !== undefined) {
                const finalExpires = newExpiresAt === null ? '' : newExpiresAt;
                row.dataset.expiresAt = finalExpires;
                cell.textContent = finalExpires === '' ? 'N/A' : formatTimeRemaining(finalExpires);
            }
            cell.classList.remove('loading');
            cell.classList.add('success-flash');
            setTimeout(() => cell.classList.remove('success-flash'), 1000);
        } catch (error) { 
            alert('Error updating key: ' + error.message); 
            cell.classList.remove('loading');
        }
    };

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
    
    function getTroopStat(troopType, level) {
        const basePower = TROOPS[troopType].power;
        const powerMultiplier = Math.pow(1.2, level);
        return Math.floor(basePower * powerMultiplier);
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
                        <h4>Spy Defense (Lvl ${user.spy_defense_level || 0})</h4>
                        <p id="spy-defense-cost">Cost to upgrade: ${formatBigNumber(Math.ceil(1000000 * Math.pow(3, user.spy_defense_level || 0)))} coins</p>
                        <button id="upgrade-spy-defense" class="secondary-btn" style="width: 100%;">Upgrade Spy Defense</button>
                    </div>
                </div>
            `;
            document.getElementById('upgrade-spy-defense').addEventListener('click', () => {
                sendGameAction('upgrade_spy_defense');
            });
        }
        
        // --- Dynamic Content ---
        document.querySelector('.my-army-panel h4').textContent = `Your Army (${formatBigNumber(user.power)} Power)`;
        document.getElementById('spy-defense-cost').textContent = `Cost to upgrade: ${formatBigNumber(Math.ceil(1000000 * Math.pow(3, user.spy_defense_level || 0)))} coins`;
        document.querySelector('.defense-panel h4').textContent = `Spy Defense (Lvl ${user.spy_defense_level || 0})`;


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
            const canAffordTrain = BigInt(user.king_game_coins) >= BigInt(config.cost);
            const canTrain = !trainingQueue && canAffordTrain;


            troopHtml += `
                <div class="troop-item">
                    <div class="troop-stats">
                        <h5>${config.name} (x${formatBigNumber(count)})</h5>
                        <p>Power per unit: <strong>${getTroopStat(id, level)}</strong></p>
                        <p>Level: <span class="level-info">${level}/${MAX_TROOP_LEVEL}</span></p>
                    </div>
                    <div class="troop-actions">
                        <button class="secondary-btn" data-troop-type="${id}" data-action="upgrade" ${isMax || !canAffordUpgrade ? 'disabled' : ''}>
                            Upgrade (${isMax ? 'MAX' : formatBigNumber(nextUpgradeCost)})
                        </button>
                        <input type="number" id="train-${id}-qty" placeholder="Qty" min="1" value="1">
                        <button class="discord-btn" data-troop-type="${id}" data-action="train" ${!canTrain ? 'disabled' : ''}>
                            Train (${formatBigNumber(config.cost)} ea)
                        </button>
                    </div>
                </div>
            `;
        }
        if (troopListContainer.innerHTML !== troopHtml) {
             troopListContainer.innerHTML = troopHtml;
             // Reattach listeners
             troopListContainer.querySelectorAll('button').forEach(btn => {
                const type = btn.dataset.troopType;
                if (btn.dataset.action === 'upgrade') {
                    btn.addEventListener('click', () => sendGameAction('upgrade_troop', { troopType: type }));
                } else if (btn.dataset.action === 'train') {
                    btn.addEventListener('click', () => {
                        const qtyInput = document.getElementById(`train-${type}-qty`);
                        const qty = parseInt(qtyInput.value) || 0;
                        if (qty > 0) sendGameAction('train_troops', { troopType: type, quantity: qty });
                    });
                }
            });
        }


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
            document.querySelectorAll('[data-action="train"]').forEach(btn => btn.disabled = true);

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
                        <h4>Leaderboard</h4>
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
                            <button id="spy-btn" class="secondary-btn" disabled>Spy (1k coins)</button>
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
            // Attach listeners (Spy/Attack/Target Selection)
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
