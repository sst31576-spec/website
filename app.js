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

    // --- OTHER PAGE FUNCTIONS ---
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
            
            // The server response is the new source of truth
            startGame(data); 
            
            if (action === 'rebirth') alert(`Congratulations on reaching Rebirth Level ${data.user.rebirth_level}! You've earned gems and your journey starts anew with a permanent coin bonus.`);
            if (action === 'buy_boost') alert(`Boost purchased successfully!`);
            if (action === 'train_troops') alert('Training started!');

            return data;
        } catch (error) {
            alert(`Error: ${error.message}`);
            // Do not reload on error, just show message.
            throw error;
        }
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
        updateEconomyUI();
        updateBarracksUI();
        updateBattleUI();
    }
    
    function updateEconomyUI() { /* Renders the entire Kingdom Tab */ }
    function updateBarracksUI() { /* Renders the entire Barracks Tab */ }
    function updateBattleUI() { /* Renders the entire Battle Tab */ }

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

