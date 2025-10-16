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
    const loginContainer = document.getElementById('login-container');
    const mainAppContainer = document.getElementById('main-app');
    const loginError = document.getElementById('login-error-message');
    const userNameEl = document.getElementById('user-name');
    const userAvatarEl = document.getElementById('user-avatar');
    const userStatusBadgeEl = document.getElementById('user-status-badge');
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');
    const userProfileToggle = document.getElementById('user-profile-toggle');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const manageKeysLink = document.getElementById('manage-keys-link');
    const suggestionForm = document.getElementById('suggestion-form');
    let currentUser = null;

    const checkUserStatus = async () => {
        try {
            const response = await fetch('/api/user');
            if (response.status === 401) { showLoginView(); return; }
            if (response.status === 403) {
                const data = await response.json();
                // Custom logic for Discord Join Error
                const errorMessage = 'You must join the Discord server';
                const discordLink = 'https://discord.gg/RhDnUQr4Du';
                showLoginView(errorMessage, discordLink);
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
        if (loginContainer) loginContainer.classList.remove('hidden');
        if (mainAppContainer) mainAppContainer.classList.add('hidden');
        if (loginError) {
            loginError.textContent = message;
            // Clear any previous button/content
            const parent = loginError.closest('.card-box');
            let existingBtn = document.getElementById('discord-join-btn');
            if(existingBtn) existingBtn.remove();
            
            // Add custom Discord join button if the specific error message is present
            if (message === 'You must join the Discord server.' && discordLink) {
                const joinBtn = document.createElement('a');
                joinBtn.id = 'discord-join-btn';
                joinBtn.href = discordLink;
                joinBtn.target = '_blank';
                joinBtn.className = 'discord-btn';
                joinBtn.style.marginTop = '15px';
                joinBtn.textContent = 'Click to join the discord';
                parent.appendChild(joinBtn);
            }
        }
    };

    const setupMainApp = (user) => {
        if (loginContainer) loginContainer.classList.add('hidden');
        if (mainAppContainer) mainAppContainer.classList.remove('hidden');
        if (userNameEl) userNameEl.textContent = user.discord_username;
        if (userAvatarEl) userAvatarEl.src = user.discord_avatar || 'assets/logo.png';
        const displayStatus = user.isAdmin ? 'Admin' : user.user_status;
        if (userStatusBadgeEl) {
            userStatusBadgeEl.textContent = displayStatus;
            userStatusBadgeEl.className = 'status-badge ' + displayStatus.toLowerCase();
        }
        if (user.isAdmin && manageKeysLink) {
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
    };

    const handleRouting = () => {
        const path = window.location.pathname.replace(/\/$/, "");
        let pageId = 'home';
        if (path === '/get-key') pageId = 'get-key';
        if (path === '/suggestion') pageId = 'suggestion';
        if (path === '/manage-keys') pageId = 'manage-keys';
        
        // Correction 404/SPA: Si le chemin n'est pas reconnu, on revient à la racine
        if (pageId === 'home' && path !== '' && path !== '/') {
            window.history.replaceState({page: pageId}, '', '/');
        }
        
        switchPage(pageId);
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // Only handle internal links for SPA routing
            const pageId = e.target.dataset.page;
            if (pageId) {
                e.preventDefault();
                window.history.pushState({ page: pageId }, '', `/${pageId === 'home' ? '' : pageId}`);
                switchPage(pageId);
            }
        });
    });

    if (userProfileToggle) {
        userProfileToggle.addEventListener('click', () => dropdownMenu.classList.toggle('show'));
    }
    window.addEventListener('click', (e) => {
        if (!userProfileToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
            dropdownMenu.classList.remove('show');
        }
    });

    // ===== get-key page logic (robust, POST call) =====
    const renderGetKeyPage = async () => {
        const container = document.getElementById('key-generation-content');
        if (!container || !currentUser) return;
        container.innerHTML = `<p>Checking for an existing key...</p>`;
        try {
            // First: try to get existing key (empty body)
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

            // No existing key — check for hash in URL
            const urlParams = new URLSearchParams(window.location.search);
            const hash = urlParams.get('hash');

            if (hash) {
                container.innerHTML = `
                    <p>Thank you! You can now get your key.</p>
                    <button id="generate-key-btn" class="discord-btn">Get Key</button>
                    <div id="key-display-area" class="hidden"></div>
                    <div id="generate-error" class="error-message" style="margin-top: 8px;"></div>
                `;
                const btn = document.getElementById('generate-key-btn');
                btn.addEventListener('click', () => handleGenerateKey(hash));
                // Auto-claim immediately to avoid the 10s expiry (but keep UI same)
                setTimeout(() => {
                    try {
                        handleGenerateKey(hash);
                    } catch (e) {
                        console.error('Immediate claim failed:', e);
                    }
                }, 80);
            } else {
                container.innerHTML = `
                    <p>To get your 24-hour key, please complete the task below.</p>
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
        const displayArea = document.getElementById('key-display-area');
        const errorEl = document.getElementById('generate-error');
        if (displayArea) {
            displayArea.classList.remove('hidden');
            displayArea.innerHTML = '';
        }
        if (errorEl) errorEl.textContent = '';

        try {
            const response = await fetch('/api/generate-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(hash ? { hash } : {})
            });

            // Try to parse JSON (even on non-2xx)
            const text = await response.text();
            let data;
            try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }

            if (!response.ok) {
                console.error('Server returned non-OK:', response.status, data);
                // Show friendly message with optional details
                const msg = (data && data.error) ? data.error : 'Could not generate key.';
                const details = (data && data.details) ? JSON.stringify(data.details) : '';
                if (errorEl) errorEl.innerHTML = `<strong>${msg}</strong>${details ? `<br><small>${details}</small>` : ''}`;
                if (btn) btn.classList.add('hidden');
                return;
            }

            displayKey(data);
        } catch (error) {
            console.error('Request failed:', error);
            if (displayArea) {
                displayArea.innerHTML = `<p class="error-message">Request failed. Try disabling adblock or retrying.</p>`;
            }
            if (btn) btn.classList.add('hidden');
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
                <button id="reset-hwid-btn" class="secondary-btn">Reset HWID (24h Cooldown)</button>
                <div id="hwid-status" class="status-message"></div>
                ${data.type === 'temp' ? `<p>Expires in: <strong>${formatTimeRemaining(data.expires)}</strong></p>` : ''}
            </div>
        `;
        document.getElementById('copy-key-btn').addEventListener('click', () => {
            const input = document.getElementById('generated-key-input');
            input.select();
            document.execCommand('copy');
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

    // Suggestion system
    if (suggestionForm) {
        suggestionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const suggestionTextarea = document.getElementById('suggestion-textarea');
            const gameNameInput = document.getElementById('game-name-input');
            const gameLinkInput = document.getElementById('game-link-input');
            const suggestionStatus = document.getElementById('suggestion-status');

            if(!suggestionTextarea || !suggestionStatus || !gameNameInput || !gameLinkInput) return;
            
            const suggestion = suggestionTextarea.value.trim();
            const gameName = gameNameInput.value.trim();
            const gameLink = gameLinkInput.value.trim();
            
            // Validation check
            if (gameName === '' || gameLink === '' || suggestion === '') {
                suggestionStatus.className = 'status-message error';
                suggestionStatus.textContent = 'Please provide a **Game Name**, a **Roblox Game Link**, and your detailed **Suggestion** to send.';
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
                suggestionStatus.textContent = 'Suggestion sent successfully! Thank you.';
                
                // Clear inputs on success
                suggestionTextarea.value = '';
                gameNameInput.value = '';
                gameLinkInput.value = '';
            } catch (error) {
                suggestionStatus.className = 'status-message error';
                suggestionStatus.textContent = error.message || 'Failed to send suggestion.';
            } finally {
                btn.disabled = false;
                btn.textContent = 'Send Suggestion';
            }
        });
    }

    // Admin panel 
    const renderAdminPanel = async () => {
        const container = document.getElementById('admin-key-list');
        if (!container) return;
        container.innerHTML = '<p>Loading keys...</p>';
        try {
            const response = await fetch('/api/admin/keys');
            if (!response.ok) throw new Error('Failed to fetch keys.');
            const keys = await response.json();
            container.innerHTML = `<input type="search" id="admin-search-input" placeholder="Search by key or username..." autocomplete="off">`;
            const table = document.createElement('table');
            table.className = 'admin-table';
            table.innerHTML = `<thead><tr><th>Key</th><th>Type</th><th>Owner</th><th>HWID (Roblox ID)</th><th>Expires In</th><th>Actions</th></tr></thead><tbody></tbody>`;
            container.appendChild(table);
            const tbody = table.querySelector('tbody');
            if (keys.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No keys found.</td></tr>';
            } else {
                // MODIFICATION: Ajout de l'attribut data-expires-at sur la ligne
                tbody.innerHTML = keys.map(key => `
                    <tr data-key-id="${key.id}" data-expires-at="${key.expires_at || ''}">
                        <td class="key-value">${key.key_value}</td>
                        <td>${key.key_type}</td>
                        <td class="owner-name">${key.discord_username || 'N/A'}</td>
                        <td class="hwid-cell">${key.roblox_user_id || 'Not Set'}</td>
                        <td class="expires-cell">${key.key_type === 'temp' ? formatTimeRemaining(key.expires_at) : 'N/A'}</td>
                        <td class="actions-cell">
                            <button class="edit-hwid-btn secondary-btn">Edit</button>
                            <button class="delete-key-btn secondary-btn-red">Delete</button>
                        </td>
                    </tr>`).join('');
            }
            const searchInput = document.getElementById('admin-search-input');
            const tableRows = container.querySelectorAll('tbody tr');
            searchInput.addEventListener('input', () => {
                const searchTerm = searchInput.value.toLowerCase();
                tableRows.forEach(row => {
                    const keyValue = row.querySelector('.key-value').textContent.toLowerCase();
                    const ownerName = row.querySelector('.owner-name').textContent.toLowerCase();
                    row.style.display = (keyValue.includes(searchTerm) || ownerName.includes(searchTerm)) ? '' : 'none';
                });
            });
            document.querySelectorAll('.delete-key-btn').forEach(btn => btn.addEventListener('click', handleDeleteKey));
            document.querySelectorAll('.edit-hwid-btn').forEach(btn => btn.addEventListener('click', handleEditHwid));
        } catch (error) {
            container.innerHTML = `<p class="error-message">${error.message}</p>`;
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

    const handleEditHwid = async (e) => {
        const row = e.target.closest('tr');
        const keyId = row.dataset.keyId;
        const currentHwid = row.querySelector('.hwid-cell').textContent.trim();
        const keyType = row.querySelector('td:nth-child(2)').textContent.trim(); 
        const currentExpires = row.dataset.expiresAt; 
        
        const newHwid = prompt('Enter the new Roblox User ID (leave blank to clear HWID):', currentHwid === 'Not Set' ? '' : currentHwid);
        
        if (newHwid !== null) {
            let newExpires = undefined; 

            // Si c'est une clé temporaire, demande aussi la nouvelle expiration
            if (keyType === 'temp') {
                 // Format YYYY-MM-DDTHH:mm (ISO 8601 partiel)
                 const defaultExpire = currentExpires ? 
                                       currentExpires.substring(0, 16) : 
                                       new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().substring(0, 16);
                                       
                 const promptText = 'Enter the new expiry date/time (e.g., YYYY-MM-DDTHH:mm, leave blank to keep current):\n\nIf you want to clear the expiry, press OK and leave the input empty.';
                 newExpires = prompt(promptText, defaultExpire);
                 
                 if (newExpires === null) return; 
            }
            
            try {
                const response = await fetch('/api/admin/keys', { 
                    method: 'PUT', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ 
                        key_id: keyId, 
                        new_roblox_user_id: newHwid,
                        new_expires_at: newExpires // Envoi de la nouvelle expiration
                    }) 
                });
                
                if (!response.ok) throw new Error('Failed to update.');
                
                // Mise à jour de l'affichage
                row.querySelector('.hwid-cell').textContent = newHwid.trim() === '' ? 'Not Set' : newHwid.trim();
                
                // Si l'expiration a été gérée et n'est pas undefined 
                if (keyType === 'temp' && newExpires !== undefined) {
                    const finalExpires = newExpires.trim() === '' ? '' : newExpires.trim();
                    
                    row.dataset.expiresAt = finalExpires;
                    row.querySelector('.expires-cell').textContent = finalExpires === '' ? 'N/A' : formatTimeRemaining(finalExpires);
                }


            } catch (error) { alert('Error updating key: ' + error.message); }
        }
    };

    checkUserStatus();
});
