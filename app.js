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
    // This is the main entry point of the script.
    
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
            // Fallback if admin link isn't present
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
    
    // --- Page Rendering Functions ---
    
    const renderGetKeyPage = async () => { /* This function remains as it was */ };
    const renderAdminPanel = async () => { /* This function remains as it was */ };

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
            }, 1200);
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
            setTimeout(() => card.classList.add('is-flipping'), 50);
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
            }, index * 250);
        });
    };
    
    const handleBlackjackAction = async (action, bet = null) => { /* ... This function remains as it was ... */ };
    
    const renderBlackjackInterface = (gameState = null) => {
        const container = document.getElementById('blackjack-view-content');
        if (!container) return;
        
        container.innerHTML = '';

        if (!gameState || !gameState.deck) {
            container.innerHTML = `
                <p>Get closer to 21 than the dealer without going over. Win 2x your bet. Blackjack pays 3:2.</p>
                <div class="game-interface">
                    <div class="bet-controls"> ... </div>
                    <button id="blackjack-deal-btn" class="discord-btn">Deal Cards</button>
                    <div id="blackjack-result" class="game-result"></div>
                </div>`;
            document.getElementById('blackjack-deal-btn').addEventListener('click', () => {
                handleBlackjackAction('deal', document.getElementById('blackjack-bet').value);
            });
            return;
        }

        container.innerHTML = `<div id="blackjack-board"> ... </div>`;
        const playerHandEl = document.getElementById('player-hand');
        const dealerHandEl = document.getElementById('dealer-hand');
        
        dealCardsAnimated(gameState.playerHand, playerHandEl, true);
        dealCardsAnimated(gameState.dealerHand, dealerHandEl, gameState.gameOver);
        
        // ... (Rest of the blackjack rendering logic)
    };
    
    let kingGameState = { coins: BigInt(0), upgrades: {}, cps: 0, clickValue: 1 };
    const handleKingGameAction = async (action, params = {}) => { /* ... This function remains as it was ... */ };
    
    const handleRecipientSearch = async (e) => {
        const query = e.target.value;
        const suggestionsEl = document.getElementById('recipient-suggestions');
        if (query.length < 2) {
            suggestionsEl.innerHTML = '';
            return;
        }
        try {
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
        } catch (error) {
            console.error("Search failed:", error);
        }
    };

    const handleSendTime = async () => { /* ... This function remains as it was ... */ };

    const updateTimeDisplay = async () => {
        const timeDisplayEl = document.querySelector('.time-display p');
        if (!timeDisplayEl) return;
        try {
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
        } catch (error) {
            // Handle cases where the user might not have a key
            timeDisplayEl.textContent = "N/A";
        }
    };
    
    const renderKingGameView = () => { /* ... This function remains as it was ... */ };

    const renderCoinFlipView = () => {
        const container = document.getElementById('earn-time-content');
        container.innerHTML = `
            <div class="game-view">
                <div class="game-view-header">
                    <button class="back-to-menu-btn">&lt; Back to Games</button>
                    <h4>Coin Flip</h4>
                </div>
                <div class="coin-flipper"><div class="coin"><div class="coin-face coin-front">👑</div><div class="coin-face coin-back">☠️</div></div></div>
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
            </div>`;
        document.querySelector('.back-to-menu-btn').addEventListener('click', renderEarnTimePage);
        document.getElementById('coinflip-btn').addEventListener('click', handleCoinFlip);
    };

    const renderBlackjackView = () => { /* ... This function remains as it was ... */ };
    
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
                                <input type="text" id="send-time-recipient" placeholder="Recipient's Username">
                                <div id="recipient-suggestions" class="autocomplete-suggestions"></div>
                            </div>
                            <select id="send-time-amount">...</select>
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
                <p>Select a game to play:</p>
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
    
    // --- Initialization ---

    const initialize = async () => {
        try {
            const response = await fetch('/api/user');
            if (!response.ok) {
                if (response.status === 401) showLoginView();
                else if (response.status === 403) showLoginView('You must join the Discord server.', 'https://discord.gg/RhDnUQr4Du');
                else throw new Error('Failed to fetch user data');
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

