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
        } catch {
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
        if (user.isAdmin) manageKeysLink.classList.remove('hidden');
        handleRouting();
    };

    const switchPage = (pageId) => {
        pages.forEach(page => page.classList.toggle('hidden', page.id !== `page-${pageId}`));
        navLinks.forEach(link => link.classList.toggle('active', link.dataset.page === pageId));
        if (pageId === 'get-key') renderGetKeyPage();
    };

    const handleRouting = () => {
        const path = window.location.pathname.replace(/\/$/, "");
        let pageId = 'home';
        if (path === '/get-key') pageId = 'get-key';
        if (path === '/suggestion') pageId = 'suggestion';
        if (path === '/manage-keys') pageId = 'manage-keys';
        if (pageId === 'home' && path !== '') window.history.replaceState({page: pageId}, '', '/');
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
        if (!userProfileToggle.contains(e.target) && !dropdownMenu.contains(e.target)) dropdownMenu.classList.remove('show');
    });

    const renderGetKeyPage = async () => {
        const container = document.getElementById('key-generation-content');
        if (!container || !currentUser) return;
        container.innerHTML = `
            <div class="discord-card">
                <div class="loader"></div>
                <p>Checking for an existing key...</p>
            </div>
        `;
        
        try {
            const response = await fetch('/api/generate-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed_task: false })
            });

            const data = await response.json();
            if (response.ok) {
                displayKey(data);
                return;
            }
            if (response.status === 403) {
                const urlParams = new URLSearchParams(window.location.search);
                const hasCompletedTask = urlParams.get('completed') === 'true';
                if (hasCompletedTask) {
                    container.innerHTML = `
                        <div class="discord-card">
                            <p>Thank you! You can now get your key.</p>
                            <button id="generate-key-btn" class="discord-btn">Get Key</button>
                            <div id="key-display-area" class="hidden"></div>
                        </div>
                    `;
                    document.getElementById('generate-key-btn').addEventListener('click', handleGenerateKey);
                } else {
                    container.innerHTML = `
                        <div class="discord-card">
                            <p>To get your 24-hour key, please complete the task below.</p>
                            <a href="https://link-hub.net/1409420/j5AokQm937Cf" class="discord-btn">Start Task</a>
                            <p class="text-muted" style="margin-top: 1rem; font-size: 14px;">After completing the task, you will be redirected back here to claim your key.</p>
                        </div>
                    `;
                }
            } else {
                throw new Error(data.error || 'An unexpected error occurred.');
            }
        } catch {
            container.innerHTML = `<p class="error-message">Server unreachable or timeout. Try again later.</p>`;
        }
    };

    const handleGenerateKey = async () => {
        const area = document.getElementById('key-display-area');
        if (!area) return;
        area.classList.remove('hidden');
        area.innerHTML = `<div class="loader"></div><p>Generating your key...</p>`;
        try {
            const response = await fetch('/api/generate-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed_task: true })
            });
            const data = await response.json();
            if (response.ok) displayKey(data);
            else area.innerHTML = `<p class="error-message">${data.error || 'Key generation failed.'}</p>`;
        } catch {
            area.innerHTML = `<p class="error-message">Connection error while generating key.</p>`;
        }
    };

    const displayKey = (data) => {
        const container = document.getElementById('key-generation-content');
        if (!container) return;
        const expiry = data.expiry ? formatTimeRemaining(data.expiry) : 'N/A';
        container.innerHTML = `
            <div class="discord-card">
                <h2>Your Key</h2>
                <div class="key-box">${data.key}</div>
                <p>Expires in: <b>${expiry}</b></p>
                <div class="button-group">
                    <button class="discord-btn" onclick="navigator.clipboard.writeText('${data.key}')">Copy Key</button>
                    <button id="reset-hwid-btn" class="discord-btn danger">Reset HWID</button>
                </div>
            </div>
        `;
        document.getElementById('reset-hwid-btn').addEventListener('click', handleResetHwid);
    };

    const handleResetHwid = async () => {
        const btn = document.getElementById('reset-hwid-btn');
        if (!btn) return;
        btn.disabled = true;
        btn.textContent = "Resetting...";
        try {
            const res = await fetch('/api/reset-hwid', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                btn.textContent = "HWID Reset!";
                setTimeout(() => renderGetKeyPage(), 1200);
            } else {
                btn.textContent = data.error || "Failed to reset";
                btn.disabled = false;
            }
        } catch {
            btn.textContent = "Error";
            btn.disabled = false;
        }
    };

    checkUserStatus();
});
