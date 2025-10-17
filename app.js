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
    // NOUVEAU: Sélection du bouton de suppression
    const removeExpiredBtn = document.getElementById('remove-expired-btn');
    let currentUser = null;

    const setupMobileNav = () => {
        const mainNav = document.querySelector('.top-bar-left nav');
        const mobileNavContainer = document.getElementById('mobile-nav-links');
        const dropdownMenu = document.getElementById('dropdown-menu');
        if (!mainNav || !mobileNavContainer || !dropdownMenu) return;
        mobileNavContainer.innerHTML = '';
        mainNav.querySelectorAll('a').forEach(link => {
            const clone = link.cloneNode(true);
            clone.addEventListener('click', (e) => {
                if (clone.dataset.page) {
                    e.preventDefault();
                    window.history.pushState({ page: clone.dataset.page }, '', `/${clone.dataset.page === 'home' ? '' : clone.dataset.page}`);
                    switchPage(clone.dataset.page);
                }
                dropdownMenu.classList.remove('show');
            });
            mobileNavContainer.appendChild(clone);
        });
    };
    setupMobileNav();

    const checkUserStatus = async () => {
        try {
            const response = await fetch('/api/user');
            if (response.status === 401) { showLoginView(); return; }
            if (response.status === 403) {
                const data = await response.json();
                const errorMessage = 'You must join the Discord server.';
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
            const parent = loginError.closest('.card-box');
            let existingBtn = document.getElementById('discord-join-btn');
            if(existingBtn) existingBtn.remove();
            
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
        
        if (pageId === 'home' && path !== '' && path !== '/') {
            window.history.replaceState({page: pageId}, '', '/');
        }
        
        switchPage(pageId);
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const pageId = e.target.dataset.page;
            if (pageId) {
                e.preventDefault();
                window.history.pushState({ page: pageId }, '', `/${pageId === 'home' ? '' : pageId}`);
                switchPage(pageId);
            }
        });
    });

    if (manageKeysLink) {
        manageKeysLink.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = 'manage-keys';
            window.history.pushState({ page: pageId }, '', '/manage-keys');
            switchPage(pageId);
            dropdownMenu.classList.remove('show');
        });
    }

    if (userProfileToggle) {
        userProfileToggle.addEventListener('click', () => dropdownMenu.classList.toggle('show'));
    }
    window.addEventListener('click', (e) => {
        if (userProfileToggle && !userProfileToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
            dropdownMenu.classList.remove('show');
        }
    });

    const renderGetKeyPage = async () => {
        // ... (code inchangé)
    };
    const handleGenerateKey = async (hash = null) => {
        // ... (code inchangé)
    };
    const displayKey = (data) => {
        // ... (code inchangé)
    };
    const handleResetHwid = async () => {
        // ... (code inchangé)
    };

    if (suggestionForm) {
        // ... (code inchangé)
    }

    const renderAdminPanel = async () => {
        const container = document.getElementById('admin-key-list');
        if (!container) return;
        container.innerHTML = '<p>Loading keys...</p>'; // Nettoie le conteneur avant de charger
        try {
            const response = await fetch('/api/admin/keys');
            if (!response.ok) throw new Error('Failed to fetch keys.');
            const keys = await response.json();
            
            // La barre de recherche est maintenant dans l'HTML, on ne la crée plus ici.
            // On vide juste le conteneur avant d'ajouter le tableau.
            container.innerHTML = ''; 
            
            const table = document.createElement('table');
            table.className = 'admin-table';
            table.innerHTML = `<thead><tr><th>Key</th><th>Type</th><th>Owner</th><th>HWID (Roblox ID)</th><th>Expires In</th><th>Action</th></tr></thead><tbody></tbody>`;
            container.appendChild(table);
            const tbody = table.querySelector('tbody');

            if (keys.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No keys found.</td></tr>';
            } else {
                tbody.innerHTML = keys.map(key => `
                    <tr data-key-id="${key.id}" data-key-type="${key.key_type}" data-expires-at="${key.expires_at || ''}">
                        <td class="key-value">${key.key_value}</td>
                        <td><span class="key-badge ${key.key_type}">${key.key_type}</span></td> 
                        <td class="owner-name">${key.discord_username || 'N/A'}</td>
                        <td class="hwid-cell editable">${key.roblox_user_id || 'Not Set'}</td>
                        <td class="expires-cell editable">${key.key_type === 'temp' ? formatTimeRemaining(key.expires_at) : 'N/A'}</td>
                        <td class="actions-cell"><button class="delete-key-btn secondary-btn-red">Delete</button></td>
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
            document.querySelectorAll('.hwid-cell.editable').forEach(cell => cell.addEventListener('click', handleEdit));
            document.querySelectorAll('.expires-cell.editable').forEach(cell => cell.addEventListener('click', handleEdit));
        } catch (error) {
            container.innerHTML = `<p class="error-message">${error.message}</p>`;
        }
    };
    
    // NOUVELLE FONCTION: Gère la suppression de toutes les clés expirées
    const handleRemoveAllExpired = async () => {
        if (!confirm('Are you sure you want to delete ALL expired keys? This action cannot be undone.')) {
            return;
        }

        const btn = document.getElementById('remove-expired-btn');
        btn.disabled = true;
        btn.textContent = 'Deleting...';

        try {
            const response = await fetch('/api/admin/keys', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete_expired' }) // Le payload qui déclenche la nouvelle logique
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Failed to delete expired keys.');
            }

            alert(result.message); // Affiche le message de succès (ex: "5 expired keys deleted.")
            renderAdminPanel(); // Rafraîchit la liste des clés

        } catch (error) {
            alert('Error: ' + error.message);
            // Réactive le bouton en cas d'erreur
            btn.disabled = false;
            btn.textContent = 'Remove All Expired';
        }
    };

    // NOUVEAU: Ajout de l'écouteur d'événement pour le bouton
    if (removeExpiredBtn) {
        removeExpiredBtn.addEventListener('click', handleRemoveAllExpired);
    }

    const handleDeleteKey = async (e) => {
        // ... (code inchangé)
    };
    const handleEdit = async (e) => {
        // ... (code inchangé)
    };

    checkUserStatus();
});
