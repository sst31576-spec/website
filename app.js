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

    // --- King Game (Clicker) ---
    const KING_GAME_MAX_LEVEL = 50; // Must match backend config
    const KING_GAME_UPGRADES_CONFIG = {
        click: { name: 'Royal Scepter', baseCost: 15, costMultiplier: 1.15, value: 1, description: 'Increases coins earned per click.' },
        b1: { name: 'Peasant Hut', baseCost: 100, costMultiplier: 1.1, cps: 1, description: 'Generates 1 coin per second.' },
        b2: { name: 'Farm', baseCost: 1100, costMultiplier: 1.12, cps: 8, description: 'Generates 8 coins per second.' },
        b3: { name: 'Castle', baseCost: 12000, costMultiplier: 1.14, cps: 45, description: 'Generates 45 coins per second.' },
        b4: { name: 'Kingdom', baseCost: 130000, costMultiplier: 1.16, cps: 250, description: 'Generates 250 coins per second.' },
    };
    let kingGameState = { coins: BigInt(0), upgrades: {}, cps: 0, clickValue: 1, rebirth_level: 0 };
    let kingGameInterval = null;

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
        if (kingGameInterval) { // Stop King Game loop when changing pages
            clearInterval(kingGameInterval);
            kingGameInterval = null;
        }
        pages.forEach(page => {
            page.classList.toggle('hidden', page.id !== `page-${pageId}`);
        });
        navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.page === pageId);
        });
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
    
    // --- "Earn Time" Game Logic ---
    const handleCoinFlip = async () => {
        // ... (This function remains but will fail until backend code is provided)
    };

    const handleBlackjackAction = async (action, bet = null) => {
        // ... (This function remains but will fail until backend code is provided)
    };
    
    // --- King Game ---
    const formatKingGameNumber = (numStr) => {
        return BigInt(numStr).toLocaleString('en-US');
    };

    const getUpgradeCost = (upgradeId, level) => {
        const upgrade = KING_GAME_UPGRADES_CONFIG[upgradeId];
        return BigInt(Math.ceil(upgrade.baseCost * Math.pow(upgrade.costMultiplier, level)));
    };
    
    const handleKingGameAction = async (action, params = {}) => {
        const payload = { game: 'king_game', action, ...params };

        try {
            const response = await fetch('/api/earn-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'King Game action failed.');
            
            kingGameState.coins = BigInt(data.coins);
            kingGameState.upgrades = data.upgrades;
            kingGameState.rebirth_level = data.rebirth_level || 0;
            
            // Recalculate local stats based on server response
            const bonus = 1 + kingGameState.rebirth_level * 0.1;
            const getLevel = (id) => kingGameState.upgrades[id] || 0;
            kingGameState.clickValue = Math.round((1 + (getLevel('click') * KING_GAME_UPGRADES_CONFIG.click.value)) * bonus);
            
            let newCps = 0;
            for (const id in KING_GAME_UPGRADES_CONFIG) {
                if (id !== 'click') {
                    newCps += getLevel(id) * KING_GAME_UPGRADES_CONFIG[id].cps;
                }
            }
            kingGameState.cps = Math.round(newCps * bonus);
            
            if (action === 'convert_time') {
                 const timeResponse = await fetch('/api/earn-time');
                 const timeData = await timeResponse.json();
                 document.querySelector('#earn-time-content .time-display p').textContent = formatTimeRemaining(timeData.expires_at);
                 alert("Success! 1 hour has been added to your key.");
            }
            if (action === 'send_coins') {
                 alert("Coins sent successfully!");
            }
            if (action === 'rebirth') {
                alert(`Congratulations on reaching Rebirth Level ${kingGameState.rebirth_level}! Your journey starts anew with a permanent coin bonus.`);
            }

            updateKingGameUI();

        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    };
    
    const updateKingGameUI = () => {
        const coinCountEl = document.getElementById('kg-coin-count');
        const cpsCountEl = document.getElementById('kg-cps-count');
        const bonusDisplayEl = document.getElementById('kg-bonus-display');

        if (coinCountEl) coinCountEl.textContent = formatKingGameNumber(kingGameState.coins.toString());
        if (cpsCountEl) cpsCountEl.textContent = `${formatKingGameNumber(kingGameState.cps.toString())} coins/sec`;
        
        if (bonusDisplayEl) {
            const bonus = 1 + (kingGameState.rebirth_level || 0) * 0.1;
            bonusDisplayEl.textContent = `Coin Bonus: x${bonus.toFixed(2)}`;
            bonusDisplayEl.style.display = kingGameState.rebirth_level > 0 ? 'block' : 'none';
        }

        const upgradesContainer = document.getElementById('kg-upgrades-list');
        if (!upgradesContainer) return;

        let allMaxed = true;
        upgradesContainer.innerHTML = '';
        for (const id in KING_GAME_UPGRADES_CONFIG) {
            const config = KING_GAME_UPGRADES_CONFIG[id];
            const level = kingGameState.upgrades[id] || 0;
            
            if (level < KING_GAME_MAX_LEVEL) {
                allMaxed = false;
            }

            const cost = getUpgradeCost(id, level);
            const canAfford = kingGameState.coins >= cost;

            const item = document.createElement('div');
            item.className = 'upgrade-item';
            item.innerHTML = `
                <div class="upgrade-info">
                    <strong>${config.name} (Lvl ${level})</strong>
                    <small style="color: #a4a4a4; font-style: italic;">${config.description}</small>
                    <small>Cost: ${formatKingGameNumber(cost.toString())}</small>
                </div>
                <button class="secondary-btn" data-upgrade-id="${id}" ${canAfford ? '' : 'disabled'}>Buy</button>
            `;
            upgradesContainer.appendChild(item);
        }
        
        upgradesContainer.querySelectorAll('button').forEach(btn => btn.addEventListener('click', (e) => {
            handleKingGameAction('buy_upgrade', { upgradeId: e.target.dataset.upgradeId });
        }));

        const actionsContainer = document.getElementById('kg-actions-container');
        let rebirthBtn = document.getElementById('kg-rebirth-btn');
        if (allMaxed) {
            if (!rebirthBtn) {
                rebirthBtn = document.createElement('button');
                rebirthBtn.id = 'kg-rebirth-btn';
                rebirthBtn.className = 'discord-btn';
                rebirthBtn.style.backgroundColor = 'var(--brand-green)';
                rebirthBtn.addEventListener('click', () => {
                    if (confirm('Are you sure you want to rebirth? This will reset your coins and upgrades for a permanent bonus.')) {
                        handleKingGameAction('rebirth');
                    }
                });
                actionsContainer.prepend(rebirthBtn);
            }
            rebirthBtn.textContent = `Rebirth (Level ${kingGameState.rebirth_level + 1})`;
        } else {
            if (rebirthBtn) {
                rebirthBtn.remove();
            }
        }
    };
    
    const renderKingGame = () => {
        const container = document.getElementById('king-game-container');
        container.innerHTML = `
            <div class="king-game-container">
                <div class="king-game-main">
                    <div class="coin-display">
                        <h2 id="kg-coin-count">0</h2>
                        <p id="kg-cps-count">0 coins/sec</p>
                        <p id="kg-bonus-display" style="color: var(--brand-green); font-weight: bold; display: none;"></p>
                    </div>
                    <div class="clicker-area">
                        <button id="kg-clicker-btn">👑</button>
                    </div>
                    <div id="kg-actions-container" class="king-game-actions">
                        <button id="kg-convert-btn" class="discord-btn">Convert 1M coins to 1h</button>
                        <input type="text" id="kg-recipient-name" placeholder="Recipient Username">
                        <input type="number" id="kg-send-amount" placeholder="Amount to Send" min="1">
                        <button id="kg-send-btn" class="secondary-btn">Send Coins</button>
                    </div>
                </div>
                <div class="king-game-upgrades">
                    <h4>Upgrades</h4>
                    <div id="kg-upgrades-list">Loading...</div>
                </div>
            </div>
        `;

        document.getElementById('kg-clicker-btn').addEventListener('click', () => {
            const btn = document.getElementById('kg-clicker-btn');
            btn.disabled = true; // Prevent spamming while waiting for server
            handleKingGameAction('click').finally(() => { btn.disabled = false; });
        });
        document.getElementById('kg-convert-btn').addEventListener('click', () => handleKingGameAction('convert_time'));
        document.getElementById('kg-send-btn').addEventListener('click', () => {
            const recipientName = document.getElementById('kg-recipient-name').value;
            const amount = document.getElementById('kg-send-amount').value;
            if(recipientName && amount > 0) {
                handleKingGameAction('send_coins', { recipientName, amount });
            } else {
                alert("Please provide a recipient and a valid amount.");
            }
        });

        if (kingGameInterval) clearInterval(kingGameInterval);
        kingGameInterval = setInterval(() => {
            kingGameState.coins += BigInt(kingGameState.cps);
            const coinCountEl = document.getElementById('kg-coin-count');
            if (coinCountEl) coinCountEl.textContent = formatKingGameNumber(kingGameState.coins.toString());
            if (Date.now() % 5000 < 1000) {
                 updateKingGameUI();
            }
        }, 1000);

        handleKingGameAction('load');
    };
    
    const renderEarnTimePage = async () => {
        const container = document.getElementById('earn-time-content');
        if (!container || !currentUser) return;
        container.innerHTML = '<p>Loading your key information...</p>';

        try {
            const response = await fetch('/api/earn-time');
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Could not fetch key data.');
            }
            const data = await response.json();
            
            container.innerHTML = `
                <div class="time-display">
                    <h3>Your Remaining Time</h3>
                    <p>${formatTimeRemaining(data.expires_at)}</p>
                </div>
                <div class="games-grid" style="grid-template-columns: 1fr; margin-bottom: 20px;">
                     <div class="game-card" style="max-width: 800px; margin: auto;">
                        <h4>King Game</h4>
                        <p>Click the crown, buy upgrades to increase your earnings, and convert your coins into key time!</p>
                        <div id="king-game-container">Loading Game...</div>
                    </div>
                </div>
                <div class="games-grid">
                    <div class="game-card">
                        <h4>Blackjack</h4>
                        <p>Get closer to 21 than the dealer without going over. Win 2x your bet. Blackjack pays 3:2.</p>
                        <div id="blackjack-game-container"><button class="discord-btn" disabled>Coming Soon</button></div>
                    </div>
                    <div class="game-card">
                        <h4>Coin Flip</h4>
                        <p>A chance to double your bet or lose it all. The more you win in a row, the harder it gets.</p>
                        <div class="game-interface"><button class="discord-btn" disabled>Coming Soon</button></div>
                    </div>
                </div>`;
            
            renderKingGame();

        } catch (error) {
            if (currentUser && currentUser.user_status === 'Perm') {
                container.innerHTML = `
                    <h3 style="margin-bottom: 10px;">Feature Not Available for Permanent Users</h3>
                    <p style="color: var(--text-muted);">As a user with a permanent key, your access never expires. You do not need to earn time.</p>
                    <a href="/" class="discord-btn" style="margin-top: 25px;">Back to Home</a>
                `;
            } else {
                container.innerHTML = `
                    <p class="error-message" style="font-size: 1.1rem;">${error.message}</p>
                    <p>Only users with an active 'Free' key can access the games.</p>
                    <a href="/get-key" class="discord-btn" style="margin-top: 15px;">Get a Key</a>
                `;
            }
        }
    };

    const renderAdminPanel = async () => {
        // ... (This function remains unchanged)
    };
    
    const handleRemoveAllExpired = async () => {
        // ... (This function remains unchanged)
    };

    const handleDeleteKey = async (e) => {
        // ... (This function remains unchanged)
    };

    const handleEdit = async (e) => {
        // ... (This function remains unchanged)
    };

    // --- Event Listeners ---
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

    // --- Initialization ---
    setupMobileNav();
    checkUserStatus();
});
