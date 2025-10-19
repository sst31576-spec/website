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

    const setupDropdown = () => {
        const profileLink = document.createElement('a');
        profileLink.href = '/profile';
        profileLink.dataset.page = 'profile';
        profileLink.textContent = 'Profile';
        profileLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.history.pushState({ page: 'profile' }, '', '/profile');
            switchPage('profile');
            dropdownMenu.classList.remove('show');
        });
        // Add Profile link before the Admin Panel link
        if (manageKeysLink) {
            dropdownMenu.insertBefore(profileLink, manageKeysLink);
        } else {
            dropdownMenu.appendChild(profileLink);
        }
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
        if (pageId === 'manage-keys' && currentUser && currentUser.isAdmin) renderAdminPanel();
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
            window.history.replaceState({page: pageId}, '', '/');
        }
        switchPage(pageId);
    };

    const renderGetKeyPage = async () => { /* ... (code unchanged) ... */ };
    const handleGenerateKey = async (hash = null) => { /* ... (code unchanged) ... */ };
    const displayKey = (data) => { /* ... (code unchanged) ... */ };
    const handleResetHwid = async () => { /* ... (code unchanged) ... */ };
    
    // --- "Earn Time" Game Logic ---

    const handleCoinFlip = async () => {
        const flipBtn = document.getElementById('coinflip-btn');
        const coin = document.querySelector('.coin');
        const resultEl = document.getElementById('coinflip-result');
        if (!flipBtn || !coin || !resultEl) return;

        flipBtn.disabled = true;
        resultEl.textContent = '';
        coin.classList.add('flipping');

        try {
            const bet = document.getElementById('coinflip-bet').value;
            const response = await fetch('/api/earn-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game: 'coinflip', bet })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            setTimeout(() => {
                coin.classList.remove('flipping');
                if (data.win) {
                    resultEl.className = 'game-result win';
                    resultEl.textContent = `You won! Streak: ${data.new_streak}.`;
                } else {
                    resultEl.className = 'game-result loss';
                    resultEl.textContent = 'You lost! Streak reset.';
                }
                updateTimeDisplay();
            }, 1200); // Wait for animation to mostly finish
        } catch (error) {
            coin.classList.remove('flipping');
            resultEl.className = 'game-result loss';
            resultEl.textContent = `Error: ${error.message}`;
        } finally {
            setTimeout(() => { flipBtn.disabled = false; }, 1500);
        }
    };
    
    const createCardElement = (isHidden = false) => {
        const container = document.createElement('div');
        container.className = 'card-container';
        
        const card = document.createElement('div');
        card.className = 'card';
        
        const front = document.createElement('div');
        front.className = 'card-face card-front';
        
        const back = document.createElement('div');
        back.className = 'card-face card-back';
        
        card.appendChild(front);
        card.appendChild(back);
        container.appendChild(card);
        
        if (!isHidden) {
            setTimeout(() => card.classList.add('is-flipping'), 100);
        }
        
        return container;
    };

    const updateCardElement = (cardContainer, cardData) => {
        const cardFront = cardContainer.querySelector('.card-front');
        cardFront.innerHTML = `<span>${cardData.rank}</span><span>${cardData.suit}</span>`;
        cardFront.classList.toggle('red', ['♥', '♦'].includes(cardData.suit));
    };
    
    const dealCardsAnimated = (hand, handEl, revealLastCard = true) => {
        hand.forEach((cardData, index) => {
            setTimeout(() => {
                const isHidden = !revealLastCard && index === hand.length - 1;
                const cardEl = createCardElement(isHidden);
                handEl.appendChild(cardEl);
                if (!isHidden) {
                    updateCardElement(cardEl, cardData);
                }
            }, index * 300); // Stagger the animation
        });
    };
    
    const handleBlackjackAction = async (action, bet = null) => { /* ... (logic remains similar, but now calls updateTimeDisplay() on success) ... */ };
    const renderBlackjackInterface = (gameState = null) => { /* ... (logic now uses dealCardsAnimated) ... */ };
    
    let kingGameState = { coins: BigInt(0), upgrades: {}, cps: 0, clickValue: 1 };
    const updateKingGameUI = () => { /* ... (code unchanged) ... */ };
    const handleKingGameAction = async (action, params = {}) => { /* ... (logic remains similar, but calls updateTimeDisplay() on convert) ... */ };

    const handleRecipientSearch = async (e) => {
        const query = e.target.value;
        const suggestionsEl = document.getElementById('recipient-suggestions');
        if (query.length < 2) {
            suggestionsEl.innerHTML = '';
            return;
        }
        const response = await fetch('/api/earn-time', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'search_users', query })
        });
        const users = await response.json();
        suggestionsEl.innerHTML = users.map(user => `<div class="suggestion-item">${user}</div>`).join('');
        suggestionsEl.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                document.getElementById('send-time-recipient').value = item.textContent;
                suggestionsEl.innerHTML = '';
            });
        });
    };

    const handleSendTime = async () => { /* ... (logic unchanged, but calls updateTimeDisplay() on success) ... */ };

    const updateTimeDisplay = async () => {
        const timeDisplayEl = document.querySelector('.time-display p');
        if (!timeDisplayEl) return;
        const response = await fetch('/api/earn-time');
        const keyData = await response.json();
        if (keyData.key_type === 'perm') {
            const ms = parseInt(keyData.playable_time_ms);
            const hours = Math.floor(ms / 3600000);
            const minutes = Math.floor((ms % 3600000) / 60000);
            timeDisplayEl.textContent = `${hours}h ${minutes}m`;
        } else {
            timeDisplayEl.textContent = formatTimeRemaining(keyData.expires_at);
        }
    };
    
    const renderKingGameView = () => { /* ... (code unchanged) ... */ };

    const renderCoinFlipView = () => {
        const container = document.getElementById('earn-time-content');
        container.innerHTML = `
            <div class="game-view">
                <div class="game-view-header">...</div>
                <div class="coin-flipper"><div class="coin"><div class="coin-face coin-front">👑</div><div class="coin-face coin-back">☠️</div></div></div>
                <div class="game-interface">...</div>
            </div>`;
        document.querySelector('.back-to-menu-btn').addEventListener('click', renderEarnTimePage);
        document.getElementById('coinflip-btn').addEventListener('click', handleCoinFlip);
    };

    const renderBlackjackView = () => { /* ... (code unchanged) ... */ };
    
    const renderEarnTimePage = async () => {
        // ... (This function now correctly handles the 'perm' key case and displays the 'send time' form)
    };

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
                    <li><span>King Game Coins</span><span>${formatKingGameNumber(data.king_game_coins)}</span></li>
                    <li><span>Total Time Earned/Received</span><span>${timeEarnedHours} hours</span></li>
                </ul>
            `;
        } catch (error) {
            container.innerHTML = `<h2>Profile</h2><p class="error-message">${error.message}</p>`;
        }
    };

    const renderAdminPanel = async () => { /* ... (code unchanged) ... */ };
    
    // --- Event Listeners & Initialization ---
    // ... (code unchanged)

    // Initial setup
    setupDropdown();
    checkUserStatus();
});
