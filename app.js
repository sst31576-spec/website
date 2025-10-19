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
            dropdownMenu.appendChild(profileLink);
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
        if (pageId === 'suggestion') renderSuggestionPage();
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
    
    const renderGetKeyPage = async () => { /* ... (Your existing code for this function will go here) ... */ };
    const renderSuggestionPage = () => { /* ... (This is now handled by setupEventListeners) ... */ };
    const renderAdminPanel = async () => { /* ... (Your existing code for this function will go here) ... */ };
    const renderProfilePage = async () => { /* ... (Code for this new function will go here) ... */ };
    const renderEarnTimePage = async () => { /* ... (The big function for games will go here) ... */ };
    
    // ... (All other game logic and page rendering functions will be defined in the final script) ...
    
    // --- Event Listener Setup ---

    const setupEventListeners = () => {
        // Navigation links
        navLinks.forEach(link => {
            if (link.dataset.listenerAttached) return;
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pageId = e.target.dataset.page;
                if (pageId) {
                    window.history.pushState({ page: pageId }, '', `/${pageId === 'home' ? '' : pageId}`);
                    switchPage(pageId);
                }
            });
            link.dataset.listenerAttached = 'true';
        });

        // Dropdown menu
        if (userProfileToggle && !userProfileToggle.dataset.listenerAttached) {
            userProfileToggle.addEventListener('click', () => dropdownMenu.classList.toggle('show'));
            userProfileToggle.dataset.listenerAttached = 'true';
        }
        window.addEventListener('click', (e) => {
            if (userProfileToggle && !userProfileToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
                dropdownMenu.classList.remove('show');
            }
        });

        // Suggestion Form
        const suggestionForm = document.getElementById('suggestion-form');
        if (suggestionForm && !suggestionForm.dataset.listenerAttached) {
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
            suggestionForm.dataset.listenerAttached = 'true';
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
