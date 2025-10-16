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

    // --- CONSTANTES DE MONÉTISATION ---
    const LOOTLABS_BASE_URL = "https://loot-link.com/s?FyVwZ8NG"; 
    const LINKVERTISE_URL = "https://link-hub.net/1409420/j5AokQm937Cf"; 

    // --- FONCTIONS DE LANCEMENT DE MONÉTISATION ---

    const handleLootLabsLaunch = () => {
        const statusMessageEl = document.getElementById('key-status-message');
        
        if (!currentUser || !currentUser.id) {
            statusMessageEl.textContent = 'Error: Cannot retrieve user ID for LootLabs link. Please refresh.';
            return;
        }

        const discordId = currentUser.id;
        const urlToOpen = `${LOOTLABS_BASE_URL}&subid=${discordId}`; 

        window.open(urlToOpen, '_blank');
        statusMessageEl.textContent = 'LootLabs link opened in a new window. Please complete the offers.';

        setTimeout(() => {
            statusMessageEl.innerHTML += '<br>Once completed, the key will be generated. <a href="#" onclick="window.location.reload(); return false;" style="color: var(--brand-green);">Click here to refresh</a> and check your key.';
        }, 1000);
    };

    const handleLinkvertiseLaunch = () => {
        const statusMessageEl = document.getElementById('key-status-message');
        
        window.open(LINKVERTISE_URL, '_blank');
        statusMessageEl.textContent = 'Linkvertise opened in a new window. Your key will appear after completion and redirection.';
    };

    // --- LOGIQUE D'AUTHENTIFICATION ET ROUTAGE ---

    const checkUserStatus = async () => {
        try {
            const response = await fetch('/api/user');
            if (response.status === 401) { 
                showLoginView(); 
                return; 
            }

            const user = await response.json();
            currentUser = user;
            setupMainApp(user);
        } catch (error) {
            console.error('Error checking user status:', error);
            // S'il y a une erreur réseau, on affiche la vue de connexion par défaut
            showLoginView();
        }
    };

    const showLoginView = () => {
        loginContainer.classList.remove('hidden');
        if (mainAppContainer) mainAppContainer.classList.add('hidden');
    };

    const setupMainApp = (user) => {
        if (!mainAppContainer) return;

        userNameEl.textContent = user.username;
        document.getElementById('home-username').textContent = user.username;
        userAvatarEl.src = user.avatarUrl;
        userStatusBadgeEl.textContent = user.status;
        userStatusBadgeEl.className = `status-badge status-${user.status.toLowerCase()}`;
        document.getElementById('home-user-status').textContent = user.status;
        document.getElementById('home-user-status').className = `status-badge status-${user.status.toLowerCase()}`;
        
        if (user.status === 'Admin') {
            manageKeysLink.classList.remove('hidden');
        } else {
            manageKeysLink.classList.add('hidden');
        }

        loginContainer.classList.add('hidden');
        mainAppContainer.classList.remove('hidden');
        
        handleRouting();
    };

    const switchPage = (pageId) => {
        pages.forEach(page => {
            page.classList.add('hidden');
            if (page.id === pageId) {
                page.classList.remove('hidden');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === pageId) {
                link.classList.add('active');
            }
        });
        
        if (pageId === 'page-get-key') {
            renderGetKeyPage();
        } else if (pageId === 'page-manage-keys' && currentUser && currentUser.status === 'Admin') {
            renderManageKeysPage();
        }
    };

    const handleRouting = () => {
        const path = window.location.hash.substring(1) || 'page-home';
        switchPage(path);
    };

    // --- LOGIQUE DE CLÉ ET HWID UTILISATEUR ---

    const displayKey = (data) => {
        const keyDisplayContent = document.getElementById('key-display-content');
        const statusMessageEl = document.getElementById('key-status-message');
        const keyGenerationContent = document.getElementById('key-generation-content');
        
        const typeBadge = data.type === 'perm' ? 'Permanent' : `Temporary (${formatTimeRemaining(data.expires)})`;

        keyDisplayContent.innerHTML = `
            <h3>Your Access Key</h3>
            <div class="key-value-box">
                <span id="actual-key">${data.key}</span>
                <button class="copy-btn" onclick="copyKey('${data.key}')">Copy</button>
            </div>
            <p class="key-type-info">Status: <span class="status-badge status-${data.type.toLowerCase()}">${typeBadge}</span></p>
            <p>HWID: <span id="current-hwid">${data.roblox_user_id || 'Not Set'}</span></p>
            <button id="reset-hwid-btn" class="discord-btn reset-btn">Reset HWID</button>
        `;
        
        keyGenerationContent.classList.add('hidden');
        statusMessageEl.textContent = ''; 

        const resetBtn = document.getElementById('reset-hwid-btn');
        if (resetBtn) resetBtn.addEventListener('click', handleResetHwid);
    };

    window.copyKey = (key) => {
        navigator.clipboard.writeText(key).then(() => {
            alert('Key copied to clipboard!');
        }).catch(err => {
            console.error('Could not copy text: ', err);
        });
    };
    
    const handleGenerateKey = async (hash) => {
        const btn = document.getElementById('generate-key-btn');
        const errorEl = document.getElementById('generate-error');
        
        if (!btn) return;
        
        btn.disabled = true;
        btn.textContent = 'Generating...';
        if (errorEl) errorEl.textContent = '';

        try {
            const response = await fetch('/api/generate-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hash })
            });

            const data = await response.json();

            if (!response.ok) {
                if (errorEl) errorEl.textContent = data.error || 'Failed to generate key.';
                btn.textContent = 'Claim Key';
                btn.disabled = false;
                return;
            }

            displayKey(data);
            window.history.pushState({}, '', window.location.pathname); 

        } catch (error) {
            if (errorEl) errorEl.textContent = 'An unexpected error occurred.';
            btn.textContent = 'Claim Key';
            btn.disabled = false;
        }
    };

    const handleResetHwid = async () => {
        if (!confirm("Are you sure you want to reset your HWID? You can do this once every 30 days.")) return;

        const btn = document.getElementById('reset-hwid-btn');
        const currentHwidEl = document.getElementById('current-hwid');
        const oldText = btn.textContent;
        
        if (!btn || !currentHwidEl) return;
        
        btn.disabled = true;
        btn.textContent = 'Resetting...';

        try {
            const response = await fetch('/api/reset-hwid', { method: 'POST' });
            const data = await response.json();

            if (!response.ok) {
                alert(data.error || 'Failed to reset HWID.');
                btn.textContent = oldText;
                btn.disabled = false;
                return;
            }

            alert('HWID successfully reset! You can now use the script on a new device.');
            currentHwidEl.textContent = 'Not Set';
            btn.textContent = 'Reset HWID (30 days cooldown)';
            
        } catch (error) {
            alert('An unexpected error occurred: ' + error.message);
            btn.textContent = oldText;
            btn.disabled = false;
        }
    };

    // --- RENDU DE LA PAGE GET KEY ---

    const renderGetKeyPage = async () => {
        const container = document.getElementById('key-generation-content');
        if (!container || !currentUser) return;
        
        const statusMessageEl = document.getElementById('key-status-message');
        const keyDisplayContent = document.getElementById('key-display-content');
        const keyGenerationContent = document.getElementById('key-generation-content');
        
        keyDisplayContent.innerHTML = '';
        keyGenerationContent.classList.remove('hidden');
        
        // Réinitialise les listeners Linkvertise/LootLabs au cas où le HTML a été remplacé
        attachFreeKeyListeners();
        const initialButtons = document.querySelectorAll('#key-generation-content button');
        initialButtons.forEach(btn => btn.classList.remove('hidden'));

        statusMessageEl.textContent = 'Checking for an existing key...';

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
                initialButtons.forEach(btn => btn.classList.add('hidden')); 
                
                container.innerHTML = `
                    <p>Thank you! Your Linkvertise task is verified. Click below to claim your key.</p>
                    <button id="generate-key-btn" class="discord-btn" style="margin-top: 15px;">Claim Key</button>
                    <div id="key-display-area" class="hidden"></div>
                    <div id="generate-error" class="error-message" style="margin-top: 8px;"></div>
                `;
                const btn = document.getElementById('generate-key-btn');
                btn.addEventListener('click', () => handleGenerateKey(hash));
                
                setTimeout(() => {
                    try {
                        handleGenerateKey(hash);
                    } catch (e) {
                        console.error('Immediate claim failed:', e);
                    }
                }, 80);
            } else {
                statusMessageEl.textContent = 'Please choose a method to get your key (24h validity).';
            }
        } catch (error) {
            console.error(error);
            statusMessageEl.innerHTML = `<p class="error-message">An unexpected error occurred.</p>`;
        }
    };

    // --- LOGIQUE D'ADMINISTRATION DES CLÉS ---

    const renderAdminTable = (keys) => {
        const listContainer = document.getElementById('admin-key-list');
        if (!listContainer) return;
        
        let html = '<div style="overflow-x: auto;"><table class="admin-table">';
        html += `
            <thead>
                <tr>
                    <th>Key Value</th>
                    <th>Type</th>
                    <th>Discord ID</th>
                    <th>HWID</th>
                    <th>Expires In</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        keys.forEach(key => {
            const expiresText = key.expires_at ? formatTimeRemaining(key.expires_at) : 'N/A';
            const hwidText = key.roblox_user_id || 'Not Set';
            
            html += `
                <tr data-key-id="${key.key_id}">
                    <td class="key-value">${key.key_value}</td>
                    <td class="key-type">${key.key_type}</td>
                    <td>${key.owner_discord_id}</td>
                    <td class="editable-hwid" contenteditable="true" data-original="${hwidText}">${hwidText}</td>
                    <td class="editable-expires" contenteditable="true" data-original="${expiresText}">${expiresText}</td>
                    <td class="actions-cell">
                        <button class="admin-action-btn update-btn" data-action="update">Update</button>
                        <button class="admin-action-btn delete-btn" data-action="delete">Delete</button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        listContainer.innerHTML = html;

        document.querySelectorAll('.admin-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const keyId = row.dataset.keyId;
                const action = e.target.dataset.action;
                
                const hwidCell = row.querySelector('.editable-hwid');
                const expiresCell = row.querySelector('.editable-expires');

                if (action === 'update') {
                    const newHwid = hwidCell.textContent.trim() === 'Not Set' ? null : hwidCell.textContent.trim();
                    const newExpiresText = expiresCell.textContent.trim().toLowerCase();
                    
                    let newExpiresAt = null;
                    if (newExpiresText === 'n/a' || newExpiresText === 'perm' || newExpiresText === '') {
                        newExpiresAt = null; // Marque comme permanent dans la DB
                    } else {
                        // Pour la démo, on utilise un format simple comme un mois (à améliorer en prod)
                        if (!confirm("Expiration non reconnue. Voulez-vous la définir à 30 jours?")) return;
                        newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                    }

                    handleAdminKeyAction(action, keyId, newHwid, newExpiresAt);

                } else if (action === 'delete') {
                    if (confirm(`Are you sure you want to delete key ${keyId}?`)) {
                        handleAdminKeyAction(action, keyId);
                    }
                }
            });
        });
    };
    
    const handleAdminKeyAction = async (action, keyId, newHwid, newExpiresAt) => {
        const row = document.querySelector(`tr[data-key-id="${keyId}"]`);
        if (!row) return;

        try {
            let method = 'DELETE';
            let payload = { key_id: keyId };

            if (action === 'update') {
                method = 'PUT';
                // N'inclut que les valeurs non nulles dans le payload
                if (newHwid !== undefined) payload.new_roblox_user_id = newHwid;
                if (newExpiresAt !== undefined) payload.new_expires_at = newExpiresAt; 
            }

            const response = await fetch('/api/admin/keys', { 
                method: method, 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(payload) 
            });
            
            if (!response.ok) throw new Error('Action failed.');
            
            if (action === 'delete') {
                row.remove();
                alert('Key deleted successfully!');
            } else if (action === 'update') {
                alert('Key updated successfully!');
                // On recharge la page pour voir les changements formatés
                renderManageKeysPage(); 
            }

        } catch (error) { 
            alert('Error performing action: ' + error.message); 
        }
    };
    
    const renderManageKeysPage = async () => {
        const listContainer = document.getElementById('admin-key-list');
        if (!listContainer) return;
        
        listContainer.innerHTML = 'Loading keys...';

        try {
            const response = await fetch('/api/admin/keys');
            if (response.status === 403) {
                listContainer.innerHTML = '<p class="error-message">Access Denied. You are not an administrator.</p>';
                return;
            }
            if (!response.ok) throw new Error('Failed to fetch keys.');

            const data = await response.json();
            renderAdminTable(data.keys);

        } catch (error) {
            console.error('Admin Key Fetch Error:', error);
            listContainer.innerHTML = `<p class="error-message">Error fetching keys: ${error.message}</p>`;
        }
    };


    // --- LOGIQUE DE SUGGESTION ---
    
    const handleSuggestionSubmit = async (e) => {
        e.preventDefault();
        const gameName = document.getElementById('game-name-input').value;
        const gameLink = document.getElementById('game-link-input').value;
        const suggestionText = document.getElementById('suggestion-textarea').value;
        const statusEl = document.getElementById('suggestion-status');
        const btn = suggestionForm.querySelector('button');

        btn.disabled = true;
        btn.textContent = 'Sending...';
        statusEl.textContent = '';

        try {
            const response = await fetch('/api/send-suggestion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameName, gameLink, suggestionText })
            });

            const data = await response.json();

            if (response.ok) {
                statusEl.textContent = 'Suggestion successfully sent! Thank you.';
                statusEl.style.color = 'var(--brand-green)';
                suggestionForm.reset();
            } else {
                statusEl.textContent = data.error || 'Failed to send suggestion.';
                statusEl.style.color = 'var(--brand-red)';
            }
        } catch (error) {
            statusEl.textContent = 'An unexpected error occurred.';
            statusEl.style.color = 'var(--brand-red)';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Send Suggestion';
        }
    };


    // --- LIAISON DES ÉVÉNEMENTS (LISTENERS) FINAUX ---
    
    const attachFreeKeyListeners = () => {
        const linkvertiseBtn = document.getElementById('linkvertise-btn');
        const lootlabsBtn = document.getElementById('lootlabs-btn');
        
        // Retirez les anciens pour éviter les doublons si le code est exécuté plusieurs fois
        if (linkvertiseBtn) {
            linkvertiseBtn.removeEventListener('click', handleLinkvertiseLaunch);
            linkvertiseBtn.addEventListener('click', handleLinkvertiseLaunch);
        }
        if (lootlabsBtn) {
            lootlabsBtn.removeEventListener('click', handleLootLabsLaunch);
            lootlabsBtn.addEventListener('click', handleLootLabsLaunch);
        }
    };

    // Listeners pour la navigation
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.dataset.page;
            window.location.hash = pageId;
            switchPage(pageId);
        });
    });

    // Listener pour le dropdown du profil
    if (userProfileToggle) {
        userProfileToggle.addEventListener('click', () => {
            dropdownMenu.classList.toggle('active');
        });
    }

    // Listener pour la déconnexion
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/auth/logout';
        });
    }

    // Listener pour le formulaire de suggestion
    if (suggestionForm) {
        suggestionForm.addEventListener('submit', handleSuggestionSubmit);
    }
    
    // Initialisation
    attachFreeKeyListeners(); 
    checkUserStatus();
});
