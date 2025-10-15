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
            container.innerHTML = `<p class="error-message">${error.message}</p>`;
        }
    };

    const handleGenerateKey = async (event) => {
        const btn = event ? event.target : document.getElementById('generate-key-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Generating...';
        }
        const displayArea = document.getElementById('key-display-area');
        if (displayArea) {
            displayArea.classList.remove('hidden');
            displayArea.innerHTML = '';
        }
        
        const isFreeUserFlow = currentUser.user_status === 'Free';
        const urlParams = new URLSearchParams(window.location.search);
        const hasCompletedTask = urlParams.get('completed') === 'true';
        const bodyPayload = {
            completed_task: isFreeUserFlow && hasCompletedTask ? true : undefined
        };

        try {
            const response = await fetch('/api/generate-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            displayKey(data);
        } catch (error) {
            if(displayArea) {
                displayArea.innerHTML = `<p class="error-message">${error.message || 'Could not generate key. Please try again.'}</p>`;
            }
            if (btn) {
                btn.classList.add('hidden');
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
            statusEl.textContent = error.message;
        } finally {
            setTimeout(() => { btn.disabled = false; }, 2000);
        }
    };

    if (suggestionForm) {
        suggestionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const suggestionTextarea = document.getElementById('suggestion-textarea');
            const suggestionStatus = document.getElementById('suggestion-status');
            if(!suggestionTextarea || !suggestionStatus) return;
            const suggestion = suggestionTextarea.value;
            const btn = e.target.querySelector('button');
            btn.disabled = true;
            btn.textContent = 'Sending...';
            suggestionStatus.textContent = '';
            try {
                const response = await fetch('/api/send-suggestion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suggestion }) });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                suggestionStatus.className = 'status-message success';
                suggestionStatus.textContent = 'Suggestion sent successfully!';
                suggestionTextarea.value = '';
            } catch (error) {
                suggestionStatus.className = 'status-message error';
                suggestionStatus.textContent = error.message;
            } finally {
                btn.disabled = false;
                btn.textContent = 'Send Suggestion';
            }
        });
    }

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
                tbody.innerHTML = keys.map(key => `
                    <tr data-key-id="${key.id}">
                        <td class="key-value">${key.key_value}</td>
                        <td>${key.key_type}</td>
                        <td class="owner-name">${key.discord_username || 'N/A'}</td>
                        <td class="hwid-cell">${key.roblox_user_id || 'Not Set'}</td>
                        <td>${key.key_type === 'temp' ? formatTimeRemaining(key.expires_at) : 'N/A'}</td>
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
        const newHwid = prompt('Enter the new Roblox User ID (leave blank to clear HWID):', currentHwid === 'Not Set' ? '' : currentHwid);
        if (newHwid !== null) {
            try {
                const response = await fetch('/api/admin/keys', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key_id: keyId, new_roblox_user_id: newHwid }) });
                if (!response.ok) throw new Error('Failed to update.');
                row.querySelector('.hwid-cell').textContent = newHwid.trim() === '' ? 'Not Set' : newHwid.trim();
            } catch (error) { alert('Error updating HWID.'); }
        }
    };

    checkUserStatus();
});
