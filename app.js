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
    let currentUser = null;
    let allUsers = [];

    // --- King Game Config (Must match backend) ---
    const KING_GAME_MAX_LEVEL = 50;
    const MAX_REBIRTH_LEVEL = 10;
    const KING_GAME_UPGRADES_CONFIG = {
        click: { name: 'Royal Scepter', baseCost: 15, costMultiplier: 1.15, value: 1, description: 'Increases coins per click.' },
        b1: { name: 'Peasant Hut', baseCost: 100, costMultiplier: 1.1, cps: 1, description: 'Generates 1 coin/sec.' },
        b2: { name: 'Farm', baseCost: 1100, costMultiplier: 1.12, cps: 8, description: 'Generates 8 coins/sec.' },
        b3: { name: 'Castle', baseCost: 12000, costMultiplier: 1.14, cps: 45, description: 'Generates 45 coins/sec.' },
        b4: { name: 'Kingdom', baseCost: 130000, costMultiplier: 1.16, cps: 250, description: 'Generates 250 coins/sec.' },
        b5: { name: 'Empire', baseCost: 1500000, costMultiplier: 1.18, cps: 1400, description: 'Generates 1,400 coins/sec.' },
        b6: { name: 'Galaxy', baseCost: 20000000, costMultiplier: 1.2, cps: 7800, description: 'Generates 7,800 coins/sec.' },
        b7: { name: 'Universe', baseCost: 330000000, costMultiplier: 1.22, cps: 44000, description: 'Generates 44,000 coins/sec.' },
    };
    const GEM_BOOSTS_CONFIG = {
        'x2_coins': { name: '2x Coin Boost (1h)', cost: 10 },
        'half_cost': { name: '50% Upgrade Discount (5m)', cost: 5 },
    };

    let kingGameState = { coins: BigInt(0), upgrades: {}, cps: 0, clickValue: 1, rebirth_level: 0, gems: 0, active_boosts: {} };
    let kingGameInterval = null;
    let boostUpdateInterval = null;

    // --- Core App Functions (Login, Routing, etc.) ---
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
            const user = await response.json();
            currentUser = user;
            setupMainApp(user);
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
        if (user.isAdmin) {
            manageKeysLink.classList.remove('hidden');
        }
        handleRouting();
    };

    const switchPage = (pageId) => {
        if (kingGameInterval) clearInterval(kingGameInterval);
        if (boostUpdateInterval) clearInterval(boostUpdateInterval);
        
        pages.forEach(page => page.classList.toggle('hidden', page.id !== `page-${pageId}`));
        navLinks.forEach(link => link.classList.toggle('active', link.dataset.page === pageId));
        
        if (pageId === 'get-key') renderGetKeyPage();
        if (pageId === 'manage-keys' && currentUser && currentUser.isAdmin) renderAdminPanel();
        if (pageId === 'earn-time') renderEarnTimePage();
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

    // --- Other Page Rendering Functions (unchanged placeholders) ---
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


    // --- King Game Functions ---
    const formatKingGameNumber = (numStr) => BigInt(numStr).toLocaleString('en-US');

    const getUpgradeCost = (upgradeId, level) => {
        const upgrade = KING_GAME_UPGRADES_CONFIG[upgradeId];
        let cost = BigInt(Math.ceil(upgrade.baseCost * Math.pow(upgrade.costMultiplier, level)));
        if (kingGameState.active_boosts['half_cost'] && new Date(kingGameState.active_boosts['half_cost']) > new Date()) {
            cost = cost / BigInt(2);
        }
        return cost;
    };

    const handleKingGameAction = async (action, params = {}) => {
        const payload = { action, ...params };
        try {
            const response = await fetch('/api/earn-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'King Game action failed.');

            kingGameState = { ...kingGameState, ...data, coins: BigInt(data.coins) };
            
            if (action === 'rebirth') {
                alert(`Congratulations on reaching Rebirth Level ${kingGameState.rebirth_level}! You've earned gems and your journey starts anew with a permanent coin bonus.`);
            }
             if (action === 'buy_boost') {
                alert(`Boost purchased successfully!`);
            }
            if (action === 'send_coins') {
                 alert("Coins sent successfully!");
                 document.getElementById('kg-send-amount').value = '';
                 document.getElementById('kg-recipient-search').value = '';
            }

            updateKingGameUI();
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    };

    const updateKingGameUI = () => {
        if (!document.getElementById('king-game-container')) return;

        // Update main stats
        document.getElementById('kg-coin-count').textContent = formatKingGameNumber(kingGameState.coins.toString());
        const bonus = 1 + (kingGameState.rebirth_level || 0) * 0.1;
        
        let baseCps = 0;
        for (const id in KING_GAME_UPGRADES_CONFIG) {
            if (id !== 'click') {
                baseCps += (kingGameState.upgrades[id] || 0) * KING_GAME_UPGRADES_CONFIG[id].cps;
            }
        }
        let finalCps = Math.round(baseCps * bonus);
        if (kingGameState.active_boosts['x2_coins'] && new Date(kingGameState.active_boosts['x2_coins']) > new Date()){
            finalCps *= 2;
        }
        kingGameState.cps = finalCps;
        document.getElementById('kg-cps-count').textContent = `${formatKingGameNumber(kingGameState.cps.toString())} coins/sec`;
        
        document.getElementById('kg-gem-count').textContent = `${kingGameState.gems || 0} Gems`;
        const bonusEl = document.getElementById('kg-bonus-display');
        bonusEl.textContent = `Rebirth Bonus: x${bonus.toFixed(2)}`;
        bonusEl.style.display = kingGameState.rebirth_level > 0 ? 'block' : 'none';

        // Update Upgrades List
        const upgradesContainer = document.getElementById('kg-upgrades-list');
        let allMaxed = kingGameState.rebirth_level < MAX_REBIRTH_LEVEL;
        upgradesContainer.innerHTML = '';
        for (const id in KING_GAME_UPGRADES_CONFIG) {
            const config = KING_GAME_UPGRADES_CONFIG[id];
            const level = kingGameState.upgrades[id] || 0;
            if (level < KING_GAME_MAX_LEVEL) allMaxed = false;

            const cost = getUpgradeCost(id, level);
            const item = document.createElement('div');
            item.className = 'upgrade-item';
            item.innerHTML = `
                <div class="upgrade-info">
                    <strong>${config.name} (Lvl ${level})</strong>
                    <small class="desc">${config.description}</small>
                    <small>Cost: ${formatKingGameNumber(cost.toString())}</small>
                </div>
                <button class="secondary-btn" data-upgrade-id="${id}" ${kingGameState.coins >= cost ? '' : 'disabled'}>Buy</button>
            `;
            const btn = item.querySelector('button');
            btn.addEventListener('click', (e) => {
                e.target.disabled = true;
                handleKingGameAction('buy_upgrade', { upgradeId: e.target.dataset.upgradeId }).finally(() => { e.target.disabled = false; });
            });
            upgradesContainer.appendChild(item);
        }

        // Update Gem Shop
        const gemShopContainer = document.getElementById('kg-gem-shop');
        gemShopContainer.innerHTML = '';
        for (const id in GEM_BOOSTS_CONFIG) {
            const config = GEM_BOOSTS_CONFIG[id];
            const isActive = kingGameState.active_boosts[id] && new Date(kingGameState.active_boosts[id]) > new Date();
            const btn = document.createElement('button');
            btn.className = 'secondary-btn';
            btn.textContent = `${config.name} (${config.cost} Gems)`;
            btn.disabled = isActive || kingGameState.gems < config.cost;
            btn.addEventListener('click', () => handleKingGameAction('buy_boost', { boostId: id }));
            gemShopContainer.appendChild(btn);
        }
        
        // Update Active Boosts display
        const boostsContainer = document.getElementById('kg-active-boosts');
        boostsContainer.innerHTML = '<h4>Active Boosts</h4>';
        let hasActiveBoosts = false;
        for (const id in kingGameState.active_boosts) {
            const expiry = new Date(kingGameState.active_boosts[id]);
            if (expiry > new Date()) {
                hasActiveBoosts = true;
                const remaining = Math.ceil((expiry - new Date()) / 1000);
                const minutes = Math.floor(remaining / 60);
                const seconds = remaining % 60;
                const p = document.createElement('p');
                p.innerHTML = `${GEM_BOOSTS_CONFIG[id].name.split('(')[0].trim()}: <strong>${minutes}m ${seconds.toString().padStart(2, '0')}s</strong>`;
                boostsContainer.appendChild(p);
            }
        }
        boostsContainer.style.display = hasActiveBoosts ? 'block' : 'none';

        // Update Rebirth Button
        const rebirthContainer = document.getElementById('kg-rebirth-container');
        if (allMaxed && kingGameState.rebirth_level < MAX_REBIRTH_LEVEL) {
            rebirthContainer.innerHTML = `<button id="kg-rebirth-btn" class="discord-btn">Rebirth (Level ${kingGameState.rebirth_level + 1})</button>`;
            rebirthContainer.querySelector('#kg-rebirth-btn').addEventListener('click', () => {
                if (confirm('Are you sure you want to rebirth? This will reset your coins and upgrades for a permanent bonus and gems!')) {
                    handleKingGameAction('rebirth');
                }
            });
        } else if (kingGameState.rebirth_level >= MAX_REBIRTH_LEVEL) {
             rebirthContainer.innerHTML = `<p class="max-rebirth-msg">You have reached the max rebirth level!</p>`;
        } else {
            rebirthContainer.innerHTML = '';
        }
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
                    <div class="clicker-area">
                        <button id="kg-clicker-btn">👑</button>
                    </div>
                     <div id="kg-active-boosts" class="active-boosts-container" style="display: none;"></div>
                </div>
                <div class="kg-right-panel">
                    <div class="upgrades-container">
                        <h4>Upgrades</h4>
                        <div id="kg-upgrades-list"></div>
                    </div>
                    <div class="shop-container">
                         <h4>Gem Shop (<span id="kg-gem-count">0</span>)</h4>
                         <div id="kg-gem-shop"></div>
                    </div>
                </div>
                <div class="kg-bottom-panel">
                    <div id="kg-rebirth-container"></div>
                    <div class="send-coins-container">
                        <h4>Send Coins</h4>
                        <div class="user-select-wrapper">
                            <input type="text" id="kg-recipient-search" placeholder="Search for a user...">
                            <div id="kg-recipient-dropdown" class="user-dropdown-content"></div>
                        </div>
                        <input type="number" id="kg-send-amount" placeholder="Amount" min="1">
                        <button id="kg-send-btn" class="secondary-btn">Send</button>
                    </div>
                </div>
            </div>`;
        
        const searchInput = document.getElementById('kg-recipient-search');
        const dropdown = document.getElementById('kg-recipient-dropdown');
        let selectedUserId = null;

        searchInput.addEventListener('focus', () => dropdown.style.display = 'block');
        searchInput.addEventListener('blur', () => setTimeout(() => dropdown.style.display = 'none', 150));
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            dropdown.innerHTML = '';
            const filteredUsers = allUsers.filter(u => u.discord_username.toLowerCase().includes(query));
            filteredUsers.slice(0, 10).forEach(user => {
                const item = document.createElement('a');
                item.textContent = user.discord_username;
                item.addEventListener('mousedown', () => {
                    searchInput.value = user.discord_username;
                    selectedUserId = user.discord_id;
                    dropdown.style.display = 'none';
                });
                dropdown.appendChild(item);
            });
        });

        document.getElementById('kg-clicker-btn').addEventListener('click', (e) => {
            e.target.disabled = true;
            handleKingGameAction('click').finally(() => { e.target.disabled = false; });
        });
        
        document.getElementById('kg-send-btn').addEventListener('click', () => {
            const amount = document.getElementById('kg-send-amount').value;
            if (selectedUserId && amount > 0) {
                handleKingGameAction('send_coins', { recipientId: selectedUserId, amount });
            } else {
                alert("Please select a valid user from the list and enter a positive amount.");
            }
        });
        
        fetchUserList();
        
        if (kingGameInterval) clearInterval(kingGameInterval);
        kingGameInterval = setInterval(() => {
            kingGameState.coins += BigInt(kingGameState.cps || 0);
            if(document.getElementById('kg-coin-count')){
                document.getElementById('kg-coin-count').textContent = formatKingGameNumber(kingGameState.coins.toString());
            }
        }, 1000);

        if(boostUpdateInterval) clearInterval(boostUpdateInterval);
        boostUpdateInterval = setInterval(updateKingGameUI, 1000);

        handleKingGameAction('load');
    };

    const renderEarnTimePage = async () => {
        const container = document.getElementById('earn-time-content');
        if (!container || !currentUser) return;
        container.innerHTML = '<p>Loading your game data...</p>';

        try {
            const response = await fetch('/api/earn-time');
            if (!response.ok) throw await response.json();
            
            renderKingGame();

        } catch (error) {
            if (currentUser?.user_status === 'Perm') {
                container.innerHTML = `
                    <h3>Feature Not Available for Permanent Users</h3>
                    <p>As a user with a permanent key, your access never expires.</p>
                    <a href="/" class="discord-btn" style="margin-top: 25px;">Back to Home</a>
                `;
            } else {
                container.innerHTML = `
                    <p class="error-message">${error.error || 'Could not load game data.'}</p>
                    <p>Only users with an active 'Free' key can access this page.</p>
                    <a href="/get-key" class="discord-btn" style="margin-top: 15px;">Get a Key</a>
                `;
            }
        }
    };
    
    // --- Event Listeners ---
    if (suggestionForm) {
        suggestionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const suggestionTextarea = document.getElementById('suggestion-textarea');
            const gameNameInput = document.getElementById('game-name-input');
            const gameLinkInput = document.getElementById('game-link-input');
            const suggestionStatus = document.getElementById('suggestion-status');
            if (!suggestionTextarea || !suggestionStatus || !gameNameInput || !gameLinkInput) return;
            
            const suggestion = suggestionTextarea.value.trim();
            const gameName = gameNameInput.value.trim();
            const gameLink = gameLinkInput.value.trim();
            if (gameName === '' || gameLink === '' || suggestion === '') {
                suggestionStatus.className = 'status-message error';
                suggestionStatus.textContent = 'Please fill all fields.';
                return;
            }

            const btn = e.target.querySelector('button');
            btn.disabled = true;
            btn.textContent = 'Sending...';
            suggestionStatus.textContent = '';
            
            try {
                const response = await fetch('/api/send-suggestion', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ suggestion, gameName, gameLink }) 
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                
                suggestionStatus.className = 'status-message success';
                suggestionStatus.textContent = 'Suggestion sent!';
                suggestionForm.reset();
            } catch (error) {
                suggestionStatus.className = 'status-message error';
                suggestionStatus.textContent = error.message || 'Failed to send.';
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

    // --- Initialization ---
    setupMobileNav();
    checkUserStatus();
});

