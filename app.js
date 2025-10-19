// --- Helper Functions ---
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
    let currentUser = null;
    let kingGameInterval = null;

    // --- Core Application Logic ---

    const setupDropdown = () => {
        const existingProfileLink = dropdownMenu.querySelector('a[data-page="profile"]');
        if (existingProfileLink) return;

        const profileLink = document.createElement('a');
        profileLink.href = '#';
        profileLink.dataset.page = 'profile';
        profileLink.textContent = 'Profile';
        
        profileLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.history.pushState({ page: 'profile' }, '', '/profile');
            switchPage('profile');
            dropdownMenu.classList.remove('show');
        });
        
        if (manageKeysLink) {
            dropdownMenu.insertBefore(profileLink, manageKeysLink);
        } else {
            const logoutLink = dropdownMenu.querySelector('a[href="/auth/logout"]');
            dropdownMenu.insertBefore(profileLink, logoutLink);
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
        
        setupEventListeners();
        handleRouting();
    };

    const showLoginView = (message = null, discordLink = null) => {
        loginContainer.classList.remove('hidden');
        mainAppContainer.classList.add('hidden');
        if (loginError) {
            loginError.textContent = message;
            const parent = loginError.closest('.card-box');
            let existingBtn = document.getElementById('discord-join-btn');
            if (existingBtn) existingBtn.remove();
            
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

    const switchPage = (pageId) => {
        if (kingGameInterval) {
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
        if (pageId === 'manage-keys' && currentUser?.isAdmin) renderAdminPanel();
        if (pageId === 'earn-time') renderEarnTimePage();
        if (pageId === 'profile') renderProfilePage();
    };

    const handleRouting = () => {
        const path = window.location.pathname.replace(/\/$/, "");
        let pageId = 'home';
        if (path === '/get-key') pageId = 'get-key';
        if (path === '/suggestion') pageId = 'suggestion';
        if (path === '/manage-keys') pageId = 'manage-keys';
        if (path === '/earn-time') pageId = 'earn-time';
        if (path === '/profile') pageId = 'profile';
        
        if (pageId === 'home' && path !== '' && path !== '/') {
            window.history.replaceState({ page: 'home' }, '', '/');
        }
        switchPage(pageId);
    };
    
    // --- Page Rendering & Logic ---

    const renderGetKeyPage = async () => { /* Function content from previous versions */ };
    const renderAdminPanel = async () => { /* Function content from previous versions */ };

    const renderProfilePage = async () => {
        const container = document.getElementById('page-profile').querySelector('.card-box');
        container.innerHTML = '<h2>Profile</h2><p>Loading profile data...</p>';
        
        try {
            const response = await fetch('/api/profile');
            if (!response.ok) throw new Error('Failed to load profile.');
            const data = await response.json();
            
            const timeEarnedMs = parseInt(data.total_time_earned);
            const timeEarnedHours = (timeEarnedMs / 3600000).toFixed(1);

            container.innerHTML = `
                <h2>${data.discord_username}'s Profile</h2>
                <ul class="profile-stats">
                    <li><span>Key Type</span><span>${data.key_type === 'perm' ? 'Permanent' : 'Temporary'}</span></li>
                    <li><span>Script Executions</span><span>${data.script_executions}</span></li>
                    <li><span>King Game Coins</span><span>${BigInt(data.king_game_coins).toLocaleString('en-US')}</span></li>
                    <li><span>Total Time Earned/Received</span><span>${timeEarnedHours} hours</span></li>
                </ul>
            `;
        } catch (error) {
            container.innerHTML = `<h2>Profile</h2><p class="error-message">${error.message}</p>`;
        }
    };

    // --- "Earn Time" Game Logic ---
    const updateTimeDisplay = async () => { /* Function content from previous versions */ };
    
    const handleCoinFlip = async () => { /* Function content from previous versions */ };
    const createCardElement = (isHidden = false) => { /* Function content from previous versions */ };
    const updateCardElement = (cardContainer, cardData) => { /* Function content from previous versions */ };
    const dealCardsAnimated = (hand, handEl, revealLastCard = true) => { /* Function content from previous versions */ };
    const handleBlackjackAction = async (action, bet = null) => { /* Function content from previous versions */ };
    const renderBlackjackInterface = (gameState = null) => { /* Function content from previous versions */ };
    
    let kingGameState = { coins: BigInt(0), upgrades: {}, cps: 0, clickValue: 1 };
    const handleKingGameAction = async (action, params = {}) => { /* Function content from previous versions */ };
    const updateKingGameUI = () => { /* Function content from previous versions */ };
    
    const handleRecipientSearch = async (e) => { /* Function content from previous versions */ };
    const handleSendTime = async () => { /* Function content from previous versions */ };
    
    const renderKingGameView = () => { /* Function content from previous versions */ };
    const renderCoinFlipView = () => { /* Function content from previous versions */ };
    const renderBlackjackView = () => { /* Function content from previous versions */ };
    
    const renderEarnTimePage = async () => {
        if (kingGameInterval) clearInterval(kingGameInterval);
        const container = document.getElementById('earn-time-content');
        container.innerHTML = `<h2>Earn Time</h2><p>Loading your key information...</p>`;

        try {
            const response = await fetch('/api/earn-time');
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Could not fetch key data.');
            }
            const keyData = await response.json();
            
            let timeInfoHtml, sendTimeHtml = '';

            if (keyData.key_type === 'perm') {
                const ms = parseInt(keyData.playable_time_ms);
                const hours = Math.floor(ms / 3600000);
                const minutes = Math.floor((ms % 3600000) / 60000);
                timeInfoHtml = `<h3>Playable Time (Tokens)</h3><p>${hours}h ${minutes}m</p>`;
                
                sendTimeHtml = `
                    <div class="send-time-container">
                        <h4>Send Time to a Friend</h4>
                        <div class="send-time-controls">
                            <div class="form-group">
                                <input type="text" id="send-time-recipient" placeholder="Recipient's Username" autocomplete="off">
                                <div id="recipient-suggestions" class="autocomplete-suggestions"></div>
                            </div>
                            <select id="send-time-amount">
                                <option value="10m">10 Minutes</option>
                                <option value="30m">30 Minutes</option>
                                <option value="1h">1 Hour</option>
                            </select>
                            <button id="send-time-btn" class="secondary-btn">Send Time</button>
                        </div>
                        <div id="send-time-status" class="status-message"></div>
                    </div>`;
            } else {
                timeInfoHtml = `<h3>Your Remaining Time</h3><p>${formatTimeRemaining(keyData.expires_at)}</p>`;
            }
            
            container.innerHTML = `
                <h2>Earn Time</h2>
                <div class="time-display">${timeInfoHtml}</div>
                ${sendTimeHtml}
                <p style="text-align:center;">Select a game to play:</p>
                <div class="game-selection-menu">
                    <button id="select-king-game" class="discord-btn">King Game</button>
                    <button id="select-blackjack" class="discord-btn">Blackjack</button>
                    <button id="select-coinflip" class="discord-btn">Coin Flip</button>
                </div>`;
            
            document.getElementById('select-king-game').addEventListener('click', renderKingGameView);
            document.getElementById('select-blackjack').addEventListener('click', renderBlackjackView);
            document.getElementById('select-coinflip').addEventListener('click', renderCoinFlipView);
            if (keyData.key_type === 'perm') {
                document.getElementById('send-time-recipient').addEventListener('input', handleRecipientSearch);
                document.getElementById('send-time-btn').addEventListener('click', handleSendTime);
            }
        } catch (error) {
            container.innerHTML = `
                <h2>Earn Time</h2>
                <p class="error-message" style="font-size: 1.1rem;">${error.message}</p>
                <p>You must have an active key to access the games.</p>
                <a href="/get-key" class="discord-btn" style="margin-top: 15px;">Get a Key</a>
            `;
        }
    };
    
    // --- Event Listener Setup ---

    const setupEventListeners = () => {
        navLinks.forEach(link => {
            if (link.dataset.listenerAttached) return;
            link.addEventListener('click', (e) => {
                const pageId = e.target.dataset.page || e.target.closest('[data-page]')?.dataset.page;
                if (pageId) {
                    e.preventDefault();
                    window.history.pushState({ page: pageId }, '', `/${pageId === 'home' ? '' : pageId}`);
                    switchPage(pageId);
                }
            });
            link.dataset.listenerAttached = 'true';
        });

        if (userProfileToggle && !userProfileToggle.dataset.listenerAttached) {
            userProfileToggle.addEventListener('click', () => dropdownMenu.classList.toggle('show'));
            userProfileToggle.dataset.listenerAttached = 'true';
        }
        window.addEventListener('click', (e) => {
            if (userProfileToggle && !userProfileToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
                dropdownMenu.classList.remove('show');
            }
        });
    };
    
    // --- Initialization ---

    const initialize = async () => {
        try {
            const response = await fetch('/api/user');
            if (!response.ok) {
                if (response.status === 401) showLoginView();
                else if (response.status === 403) showLoginView('You must join the Discord server.', 'https://discord.gg/RhDnUQr4Du');
                else throw new Error(`Server responded with status: ${response.status}`);
                return;
            }
            currentUser = await response.json();
            setupDropdown();
            setupMainApp(currentUser);
        } catch (error) {
            console.error('Initialization Error:', error);
            showLoginView('An error occurred during startup. Please try again later.');
        }
    };

    initialize();
});

