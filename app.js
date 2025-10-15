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
                showLoginView(data.error || 'You must join our Discord server.');
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

    const showLoginView = (message = null) => {
        loginContainer.classList.remove('hidden');
        mainAppContainer.classList.add('hidden');
        if (message) loginError.textContent = message;
    };

    const setupMainApp = (user) => {
        loginContainer.classList.add('hidden');
        mainAppContainer.classList.remove('hidden');
        userNameEl.textContent = user.discord_username;
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
    };

    const handleRouting = () => {
        const path = window.location.pathname.replace(/\/$/, "");
        let pageId = 'home';
        if (path === '/get-key') pageId = 'get-key';
        if (path === '/suggestion') pageId = 'suggestion';
        if (path === '/manage-keys') pageId = 'manage-keys';
        
        if (pageId === 'home' && path !== '') {
            window.history.replaceState({page: pageId}, '', '/');
        }
        
        switchPage(pageId);
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = e.target.dataset.page;
            window.history.pushState({ page: pageId }, '', `/${pageId === 'home' ? '' : pageId}`);
            switchPage(pageId);
        });
    });

    userProfileToggle.addEventListener('click', () => dropdownMenu.classList.toggle('show'));
    window.addEventListener('click', (e) => {
        if (!userProfileToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
            dropdownMenu.classList.remove('show');
        }
    });

    const renderGetKeyPage = async () => {
        const container = document.getElementById('key-generation-content');
        if (!container || !currentUser) return;
        container.innerHTML = `<p>Checking for an existing key...</p>`;
        
        try {
            console.log("--- DEBUG: ÉTAPE 1 : Le script va appeler le serveur pour trouver une clé...");
            
            const response = await fetch('/api/generate-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed_task: false })
            });

            console.log("--- DEBUG: ÉTAPE 2 : Le serveur a répondu ! Statut :", response.status);

            const data = await response.json();
            if (response.ok) {
                console.log("--- DEBUG: Succès, le serveur a renvoyé une clé.");
                displayKey(data);
                return;
            }
            if (response.status === 403) {
                console.log("--- DEBUG: Info, le serveur demande de faire la tâche Linkvertise.");
                const urlParams = new URLSearchParams(window.location.search);
                const hasCompletedTask = urlParams.get('completed') === 'true';
                if (hasCompletedTask) {
                    container.innerHTML = `
                        <p>Thank you! You can now get your key.</p>
                        <button id="generate-key-btn" class="discord-btn">Get Key</button>
                        <div id="key-display-area" class="hidden"></div>
                    `;
                    document.getElementById('generate-key-btn').addEventListener('click', handleGenerateKey);
                } else {
                    container.innerHTML = `
                        <p>To get your 24-hour key, please complete the task below.</p>
                        <a href="https://link-hub.net/1409420/j5AokQm937Cf" class="discord-btn">Start Task</a>
                        <p class="text-muted" style="margin-top: 1rem; font-size: 14px;">After completing the task, you will be redirected back here to claim your key.</p>
                    `;
                }
            } else {
                throw new Error(data.error || 'An unexpected error occurred.');
            }
        } catch (error) {
            console.error("--- DEBUG: ERREUR FATALE : L'appel au serveur a échoué. Problème de connexion ou timeout.", error);
            container.innerHTML = `<p class="error-message">Failed to contact the server. This is likely a server-side timeout issue.</p>`;
        }
    };
    
    // ... (Collez ici les versions complètes de toutes les autres fonctions : handleGenerateKey, displayKey, etc.)
    const handleGenerateKey = async (event) => { /* ... */ };
    const displayKey = (data) => { /* ... */ };
    const handleResetHwid = async () => { /* ... */ };
    if (suggestionForm) { suggestionForm.addEventListener('submit', async (e) => { /* ... */ }); }
    const renderAdminPanel = async () => { /* ... */ };
    const handleDeleteKey = async (e) => { /* ... */ };
    const handleEditHwid = async (e) => { /* ... */ };

    checkUserStatus();
});
