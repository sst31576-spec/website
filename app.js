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
    // --- Sélection des éléments du DOM ---
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
    
    const handleCoinFlip = async () => {
        const betSelect = document.getElementById('coinflip-bet');
        const flipBtn = document.getElementById('coinflip-btn');
        const resultEl = document.getElementById('coinflip-result');
        
        if (!betSelect || !flipBtn || !resultEl) return;

        flipBtn.disabled = true;
        flipBtn.textContent = 'Flipping...';
        resultEl.textContent = '';
        resultEl.className = 'game-result';
        
        try {
            const response = await fetch('/api/earn-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game: 'coinflip', bet: betSelect.value })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'An unknown error occurred.');
            
            // Met à jour l'affichage du temps restant
            const timeDisplay = document.querySelector('#earn-time-content .time-display p');
            if (timeDisplay) {
                timeDisplay.textContent = formatTimeRemaining(data.new_expires_at);
            }
            
            if (data.win) {
                resultEl.className = 'game-result win';
                resultEl.textContent = `You won! You now have a win streak of ${data.new_streak}.`;
            } else {
                resultEl.className = 'game-result loss';
                resultEl.textContent = `You lost! Your streak has been reset.`;
            }
            
        } catch (error) {
            resultEl.className = 'game-result loss';
            resultEl.textContent = `Error: ${error.message}`;
        } finally {
            flipBtn.disabled = false;
            flipBtn.textContent = 'Flip the Coin';
        }
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
                
                <div class="games-grid">
                    <div class="game-card">
                        <h4>Coin Flip</h4>
                        <p>A chance to double your bet or lose it all. The more you win in a row, the harder it gets.</p>
                        <div class="game-interface">
                            <div class="bet-controls">
                                <label for="coinflip-bet">Bet:</label>
                                <select id="coinflip-bet">
                                    <option value="10m">10 Minutes</option>
                                    <option value="30m">30 Minutes</option>
                                    <option value="1h">1 Hour</option>
                                    <option value="2h">2 Hours</option>
                                </select>
                            </div>
                            <button id="coinflip-btn" class="discord-btn">Flip the Coin</button>
                            <div id="coinflip-result" class="game-result"></div>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 30px; border-top: 1px solid var(--background-primary); padding-top: 20px;">
                    <h4>More Games Coming Soon</h4>
                    <p style="color: var(--text-muted);">Blackjack & Dino Game are in development.</p>
                </div>
            `;
            // Attache l'écouteur d'événement après avoir créé le bouton
            document.getElementById('coinflip-btn').addEventListener('click', handleCoinFlip);

        } catch (error) {
            container.innerHTML = `
                <p class="error-message" style="font-size: 1.1rem;">${error.message}</p>
                <p>Only users with an active 'Free' key can access the games.</p>
                <a href="/get-key" class="discord-btn" style="margin-top: 15px;">Get a Key</a>
            `;
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

    // --- Écouteurs d'événements ---
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

    // --- Initialisation ---
    setupMobileNav();
    checkUserStatus();
});
