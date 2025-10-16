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

    // --- CONSTANTES DE MONÉTISATION (VOS LIENS) ---
    const LOOTLABS_BASE_URL = "https://loot-link.com/s?FyVwZ8NG"; 
    const LINKVERTISE_URL = "https://link-hub.net/1409420/j5AokQm937Cf"; 

    // --- FONCTIONS DE LANCEMENT ---

    const handleLootLabsLaunch = () => {
        const statusMessageEl = document.getElementById('key-status-message');
        
        if (!currentUser || !currentUser.id) {
            statusMessageEl.textContent = 'Error: Cannot retrieve user ID for LootLabs link. Please refresh.';
            return;
        }

        const discordId = currentUser.id;
        // Le paramètre 'subid' sera renvoyé par LootLabs au Webhook.
        const urlToOpen = `${LOOTLABS_BASE_URL}&subid=${discordId}`; 

        window.open(urlToOpen, '_blank');
        statusMessageEl.textContent = 'LootLabs link opened in a new window. Please complete the offers.';

        // L'utilisateur doit rafraîchir pour voir la clé générée par le Webhook.
        setTimeout(() => {
            statusMessageEl.innerHTML += '<br>Once completed, the key will be generated. <a href="#" onclick="window.location.reload(); return false;" style="color: var(--brand-green);">Click here to refresh</a> and check your key.';
        }, 1000);
    };

    const handleLinkvertiseLaunch = () => {
        const statusMessageEl = document.getElementById('key-status-message');
        
        // Le Linkvertise actuel redirige l'utilisateur vers votre page avec un hash.
        window.open(LINKVERTISE_URL, '_blank');
        statusMessageEl.textContent = 'Linkvertise opened in a new window. Your key will appear after completion and redirection.';
    };

    // --- LOGIQUE D'AUTHENTIFICATION ET ROUTAGE ---

    const checkUserStatus = async () => {
        try {
            const response = await fetch('/api/user');
            if (response.status === 401) { showLoginView(); return; }

            const user = await response.json();
            currentUser = user;
            setupMainApp(user);
        } catch (error) {
            console.error('Error checking user status:', error);
            showLoginView();
        }
    };

    const showLoginView = () => {
        loginContainer.classList.remove('hidden');
        mainAppContainer.classList.add('hidden');
    };

    const setupMainApp = (user) => {
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

    // --- LOGIQUE DE CLÉ ET HWID ---

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
        
        // Cacher le contenu de génération (boutons/messages)
        keyGenerationContent.classList.add('hidden');
        statusMessageEl.textContent = ''; 

        // Attacher le listener pour le reset HWID
        document.getElementById('reset-hwid-btn').addEventListener('click', handleResetHwid);
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
        
        btn.disabled = true;
        btn.textContent = 'Generating...';
        errorEl.textContent = '';

        try {
            const response = await fetch('/api/generate-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hash })
            });

            const data = await response.json();

            if (!response.ok) {
                errorEl.textContent = data.error || 'Failed to generate key.';
                btn.textContent = 'Claim Key';
                btn.disabled = false;
                return;
            }

            // Clé générée avec succès
            displayKey(data);
            // Nettoyer l'URL après une génération Linkvertise réussie
            window.history.pushState({}, '', window.location.pathname); 

        } catch (error) {
            errorEl.textContent = 'An unexpected error occurred.';
            btn.textContent = 'Claim Key';
            btn.disabled = false;
        }
    };

    const handleResetHwid = async () => {
        if (!confirm("Are you sure you want to reset your HWID? You can do this once every 30 days.")) return;

        const btn = document.getElementById('reset-hwid-btn');
        const currentHwidEl = document.getElementById('current-hwid');
        const oldText = btn.textContent;
        
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

    // --- RENDU DE LA PAGE GET KEY (LOGIQUE DE MONÉTISATION) ---

    const renderGetKeyPage = async () => {
        const container = document.getElementById('key-generation-content');
        if (!container || !currentUser) return;
        
        const statusMessageEl = document.getElementById('key-status-message');
        const keyDisplayContent = document.getElementById('key-display-content');
        const keyGenerationContent = document.getElementById('key-generation-content');
        
        // Réinitialisation de l'affichage
        keyDisplayContent.innerHTML = '';
        keyGenerationContent.classList.remove('hidden');
        
        const initialButtons = document.querySelectorAll('#key-generation-content button');
        initialButtons.forEach(btn => btn.classList.remove('hidden'));

        statusMessageEl.textContent = 'Checking for an existing key...';

        try {
            // 1. VÉRIFICATION DE LA CLÉ EXISTANTE
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

            // 2. GESTION DU RETOUR LINKVERTISE (HASH)
            const urlParams = new URLSearchParams(window.location.search);
            const hash = urlParams.get('hash');

            if (hash) {
                // Masquer les boutons Linkvertise/LootLabs et afficher la réclamation
                initialButtons.forEach(btn => btn.classList.add('hidden')); 
                
                container.innerHTML = `
                    <p>Thank you! Your Linkvertise task is verified. Click below to claim your key.</p>
                    <button id="generate-key-btn" class="discord-btn" style="margin-top: 15px;">Claim Key</button>
                    <div id="key-display-area" class="hidden"></div>
                    <div id="generate-error" class="error-message" style="margin-top: 8px;"></div>
                `;
                const btn = document.getElementById('generate-key-btn');
                btn.addEventListener('click', () => handleGenerateKey(hash));
                
                // Tentative de réclamation immédiate
                setTimeout(() => {
                    try {
                        handleGenerateKey(hash);
                    } catch (e) {
                        console.error('Immediate claim failed:', e);
                    }
                }, 80);
            } else {
                // 3. AFFICHAGE DES BOUTONS DE CHOIX (état par défaut)
                // Le contenu des boutons est dans index (5).html, on met juste à jour le message
                statusMessageEl.textContent = 'Please choose a method to get your key (24h validity).';
            }
        } catch (error) {
            console.error(error);
            statusMessageEl.innerHTML = `<p class="error-message">An unexpected error occurred.</p>`;
        }
    };

    // --- LOGIQUE D'ADMINISTRATION (Simplifiée pour la démo) ---
    
    // ... (Vos fonctions de gestion des clés d'administration) ...
    // Assurez-vous d'inclure ici toutes vos fonctions d'admin comme
    // renderManageKeysPage, handleAdminKeyAction, etc.

    // Cette fonction de soumission de suggestion est conservée
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
    
    // Attacher les écouteurs pour les boutons de monétisation
    const attachFreeKeyListeners = () => {
        const linkvertiseBtn = document.getElementById('linkvertise-btn');
        const lootlabsBtn = document.getElementById('lootlabs-btn');
        
        // S'assurer que les boutons existent avant d'attacher les listeners (important pour le routing)
        if (linkvertiseBtn) {
            linkvertiseBtn.addEventListener('click', handleLinkvertiseLaunch);
        }
        if (lootlabsBtn) {
            lootlabsBtn.addEventListener('click', handleLootLabsLaunch);
        }
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.dataset.page;
            window.location.hash = pageId;
            switchPage(pageId);
        });
    });

    userProfileToggle.addEventListener('click', () => {
        dropdownMenu.classList.toggle('active');
    });

    document.getElementById('logout-link').addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = '/auth/logout';
    });

    if (suggestionForm) {
        suggestionForm.addEventListener('submit', handleSuggestionSubmit);
    }
    
    // Finalisation
    attachFreeKeyListeners(); 
    checkUserStatus();
});
