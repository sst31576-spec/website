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

// Correction: Remplacez alert() par une fonction de modal pour l'environnement Canvas
function showAlert(message) {
    // Dans un environnement de production, vous utiliseriez une modale personnalisée ici.
    // Pour cet exemple de code, nous allons afficher un message dans la console et mettre à jour le statut.
    console.error("ALERT: " + message);
    const statusEl = document.getElementById('key-generation-content') || document.getElementById('suggestion-status');
    if (statusEl) {
        statusEl.innerHTML = `<p class="status-message error">${message}</p>`;
        statusEl.classList.remove('hidden');
    }
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

    const showView = (viewId) => {
        pages.forEach(page => {
            page.classList.add('hidden');
        });
        document.getElementById(`page-${viewId}`).classList.remove('hidden');

        navLinks.forEach(link => link.classList.remove('active'));
        document.querySelector(`.nav-link[data-page="${viewId}"]`)?.classList.add('active');
    };
    
    // NOUVELLE LOGIQUE: Cette page est maintenant statique et contient le lien Lootify.
    const handleGetKeyPage = () => {
        // La page "Get Key" est maintenant statique (lien Lootify). Nous n'initialisons rien en JS ici.
        // Le contenu de la carte est déjà défini dans index.html.
    };

    const handleKeyInfoPage = async () => {
        const keyDisplay = document.getElementById('key-display');
        const keyNoKey = document.getElementById('key-no-key');
        const userKeyValue = document.getElementById('user-key-value');
        const keyExpirationStatus = document.getElementById('key-expiration-status');
        const copyKeyBtn = document.getElementById('copy-key-btn');

        keyDisplay.classList.add('hidden');
        keyNoKey.classList.remove('hidden');
        keyExpirationStatus.classList.remove('success', 'error');
        userKeyValue.textContent = 'Loading...';

        try {
            const response = await fetch('/api/generate-key', { method: 'POST' });
            const data = await response.json();

            if (data.key) {
                userKeyValue.textContent = data.key;
                keyDisplay.classList.remove('hidden');
                keyNoKey.classList.add('hidden');

                if (data.type === 'temp' && data.expires) {
                    const statusText = `Temporary Key: Expires in ${formatTimeRemaining(data.expires)}.`;
                    keyExpirationStatus.textContent = statusText;
                    keyExpirationStatus.classList.add('success');
                } else if (data.type === 'perm') {
                    keyExpirationStatus.textContent = 'Permanent Key: No expiration.';
                    keyExpirationStatus.classList.add('success');
                } else {
                    keyExpirationStatus.textContent = '';
                }

                // Logique de copie
                copyKeyBtn.onclick = () => {
                    document.execCommand('copy'); // Utilisation de execCommand pour la compatibilité avec l'iframe
                    const tempInput = document.createElement('textarea');
                    tempInput.value = data.key;
                    document.body.appendChild(tempInput);
                    tempInput.select();
                    document.execCommand('copy');
                    document.body.removeChild(tempInput);
                    copyKeyBtn.textContent = 'Copied!';
                    setTimeout(() => { copyKeyBtn.textContent = 'Copy'; }, 2000);
                };
            } else {
                keyDisplay.classList.add('hidden');
                keyNoKey.classList.remove('hidden');
                // Si la requête échoue mais qu'il y a un message (e.g., 'Unknown user status'), on peut l'afficher.
                if (data.error) {
                    console.error('Key Generation Error:', data.error);
                }
            }
        } catch (error) {
            console.error('Error fetching key:', error);
            keyExpirationStatus.textContent = 'Error loading key status.';
            keyExpirationStatus.classList.add('error');
            keyDisplay.classList.add('hidden');
            keyNoKey.classList.remove('hidden');
        }
    };
    
    // 💡 Dispatcher de page
    const navigateToPage = (pageId) => {
        showView(pageId);
        if (pageId === 'key-info') {
            handleKeyInfoPage();
        } else if (pageId === 'get-key') {
            handleGetKeyPage();
        } else if (pageId === 'manage-keys') {
            handleAdminKeysPage();
        }
    };


    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToPage(e.target.dataset.page);
        });
    });

    // ... (Code existant pour le menu déroulant, suggestionForm, handleAdminKeysPage, et checkUserStatus)

    userProfileToggle.addEventListener('click', () => {
        dropdownMenu.classList.toggle('hidden');
    });
    
    document.addEventListener('click', (e) => {
        if (!userProfileToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
            dropdownMenu.classList.add('hidden');
        }
    });


    // HWID Reset Logic
    document.getElementById('reset-hwid-link').addEventListener('click', async (e) => {
        e.preventDefault();
        dropdownMenu.classList.add('hidden'); // Hide dropdown

        // Remplacement de la boîte de dialogue standard (alert/confirm)
        const confirmation = window.confirm("Are you sure you want to reset your HWID? You will need to re-validate on your executor.");

        if (confirmation) {
            try {
                const response = await fetch('/api/reset-hwid', { method: 'POST' });
                const result = await response.json();

                // Correction: Remplacer alert()
                if (result.success) {
                    showAlert('Success: HWID reset complete! You can now use your key on a different device.');
                } else {
                    showAlert('Error: Failed to reset HWID. ' + (result.message || 'Server error.'));
                }
            } catch (error) {
                // Correction: Remplacer alert()
                showAlert('An unexpected error occurred during HWID reset.');
            }
        }
    });


    // Suggestion Form Logic
    suggestionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const statusEl = document.getElementById('suggestion-status');
        statusEl.textContent = 'Sending suggestion...';
        statusEl.classList.remove('hidden', 'error', 'success');

        const gameName = document.getElementById('game-name-input').value;
        const gameLink = document.getElementById('game-link-input').value;
        const suggestionText = document.getElementById('suggestion-textarea').value;

        try {
            const response = await fetch('/api/send-suggestion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameName, gameLink, suggestionText })
            });

            const result = await response.json();

            if (result.success) {
                statusEl.textContent = 'Suggestion sent successfully! Thank you for your feedback.';
                statusEl.classList.add('success');
                suggestionForm.reset();
            } else {
                statusEl.textContent = 'Error sending suggestion: ' + (result.message || 'Unknown error.');
                statusEl.classList.add('error');
            }
        } catch (error) {
            statusEl.textContent = 'An unexpected error occurred.';
            statusEl.classList.add('error');
        }
    });

    // Admin Key Management Logic
    const handleAdminKeysPage = async () => {
        const adminKeyList = document.getElementById('admin-key-list');
        adminKeyList.innerHTML = 'Loading keys...';

        try {
            const response = await fetch('/api/admin/keys');
            if (response.status === 403) {
                adminKeyList.innerHTML = '<p class="status-message error">Access Denied: You must be an Admin.</p>';
                return;
            }
            if (!response.ok) throw new Error('Failed to fetch keys.');

            const keys = await response.json();
            renderAdminKeys(keys);

        } catch (error) {
            adminKeyList.innerHTML = `<p class="status-message error">Error: ${error.message}</p>`;
        }
    };

    const renderAdminKeys = (keys) => {
        const adminKeyList = document.getElementById('admin-key-list');
        if (keys.length === 0) {
            adminKeyList.innerHTML = '<p class="status-message">No keys found in the database.</p>';
            return;
        }

        const table = document.createElement('table');
        table.classList.add('admin-table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Key</th>
                    <th>Type</th>
                    <th>Discord ID</th>
                    <th>HWID (Roblox User ID)</th>
                    <th>Expires At</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${keys.map(key => `
                    <tr data-key-id="${key.key_id}" data-key-value="${key.key_value}" data-expires-at="${key.expires_at || ''}">
                        <td data-label="Key">${key.key_value}</td>
                        <td data-label="Type" class="key-type">${key.key_type}</td>
                        <td data-label="Discord ID">${key.owner_discord_id}</td>
                        <td data-label="HWID" class="editable-hwid">${key.roblox_user_id || 'Not Set'}</td>
                        <td data-label="Expires At" class="editable-expires">${key.key_type === 'temp' ? formatTimeRemaining(key.expires_at) : 'N/A'}</td>
                        <td data-label="Actions" class="actions-cell">
                            <button class="action-btn delete-btn" data-key-id="${key.key_id}">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        adminKeyList.innerHTML = '';
        adminKeyList.appendChild(table);

        // Add event listeners for editing and deleting
        table.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', handleDeleteKey);
        });
        table.querySelectorAll('.editable-hwid').forEach(cell => {
            cell.addEventListener('click', handleEditHwid);
        });
        table.querySelectorAll('.editable-expires').forEach(cell => {
            if (cell.closest('tr').dataset.keyType !== 'perm') { // Only allow editing for temp keys
                cell.addEventListener('click', handleEditExpires);
            }
        });
    };

    const handleDeleteKey = async (e) => {
        const btn = e.target;
        const keyId = btn.dataset.keyId;
        const row = btn.closest('tr');
        // Remplacement de la boîte de dialogue standard (alert/confirm)
        const confirmation = window.confirm(`Are you sure you want to delete key ID ${keyId}?`);

        if (confirmation) {
            btn.textContent = 'Deleting...';
            btn.disabled = true;

            try {
                const response = await fetch('/api/admin/keys', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key_id: keyId })
                });

                if (response.ok) {
                    row.remove();
                } else {
                    throw new Error('Failed to delete key.');
                }
            } catch (error) {
                // Correction: Remplacer alert()
                showAlert('Error deleting key: ' + error.message);
                btn.textContent = 'Delete';
                btn.disabled = false;
            }
        }
    };

    const handleEditHwid = (e) => {
        const cell = e.target;
        if (cell.classList.contains('editing') || cell.classList.contains('loading')) return;

        const currentValue = cell.textContent === 'Not Set' ? '' : cell.textContent;
        cell.classList.add('editing');
        cell.innerHTML = `<input type="text" value="${currentValue}" placeholder="Roblox User ID or empty">`;
        const input = cell.querySelector('input');
        input.focus();

        const saveChanges = () => {
            const newHwid = input.value.trim() || null;
            cell.classList.remove('editing');
            cell.textContent = 'Saving...';
            cell.classList.add('loading');
            sendKeyUpdate(cell, { newHwid });
        };

        input.addEventListener('blur', saveChanges);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveChanges();
            }
        });
    };

    const handleEditExpires = (e) => {
        const cell = e.target;
        if (cell.classList.contains('editing') || cell.classList.contains('loading')) return;

        const row = cell.closest('tr');
        const currentExpires = row.dataset.expiresAt; // This is the ISO date string or empty string
        
        cell.classList.add('editing');
        cell.innerHTML = `
            <select class="expires-select">
                <option value="" ${currentExpires === '' ? 'selected' : ''}>N/A (Permanent)</option>
                <option value="24" ${currentExpires !== '' && !isNaN(new Date(currentExpires)) && (new Date(currentExpires) - new Date() > 23.5 * 3600000) ? 'selected' : ''}>24 Hours</option>
                <option value="48">48 Hours</option>
                <option value="72">72 Hours</option>
                <option value="CUSTOM">Custom (ISO)</option>
            </select>
            <input type="text" class="custom-expires-input hidden" placeholder="YYYY-MM-DDTHH:MM:SSZ">
        `;
        
        const select = cell.querySelector('.expires-select');
        const customInput = cell.querySelector('.custom-expires-input');
        
        // Logic for custom input display
        if (currentExpires !== '' && !select.value) { // If it's a date but not a 24/48/72 standard value, select custom
             select.value = 'CUSTOM';
             customInput.classList.remove('hidden');
             customInput.value = currentExpires.substring(0, 19); // Display only YYYY-MM-DDTHH:MM:SS
        }
        
        select.addEventListener('change', () => {
            if (select.value === 'CUSTOM') {
                customInput.classList.remove('hidden');
                customInput.focus();
            } else {
                customInput.classList.add('hidden');
            }
        });


        const saveChanges = () => {
            cell.classList.remove('editing');
            cell.textContent = 'Saving...';
            cell.classList.add('loading');
            
            let newExpiresAt = null;

            if (select.value === 'CUSTOM') {
                const customDate = customInput.value.trim();
                if (customDate) {
                    newExpiresAt = new Date(customDate).toISOString();
                }
            } else if (select.value === '24' || select.value === '48' || select.value === '72') {
                const hours = parseInt(select.value, 10);
                newExpiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
            }
            
            sendKeyUpdate(cell, { newExpiresAt });
        };

        select.addEventListener('blur', saveChanges);
        customInput.addEventListener('blur', saveChanges);
    };


    const sendKeyUpdate = async (cell, updates) => {
        const row = cell.closest('tr');
        const keyId = row.dataset.keyId;

        try {
            const newHwid = updates.newHwid;
            const newExpiresAt = updates.newExpiresAt;

            const payload = { key_id: keyId };
            if (newHwid !== undefined) payload.new_roblox_user_id = newHwid;
            if (newExpiresAt !== undefined) payload.new_expires_at = newExpiresAt;

            const response = await fetch('/api/admin/keys', { 
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(payload) 
            });
            
            if (!response.ok) throw new Error('Failed to update.');
            
            // Mise à jour de l'affichage
            if (newHwid !== undefined) {
                cell.textContent = newHwid.trim() === '' || newHwid === null ? 'Not Set' : newHwid.trim();
            }
            
            if (newExpiresAt !== undefined) {
                const finalExpires = newExpiresAt === null ? '' : newExpiresAt;
                
                // Mettre à jour l'attribut de données pour la prochaine édition
                row.dataset.expiresAt = finalExpires;
                // Mettre à jour l'affichage formaté (par exemple: 24h 0m)
                cell.textContent = finalExpires === '' ? 'N/A' : formatTimeRemaining(finalExpires);
            }

            cell.classList.remove('loading');
            cell.classList.add('success-flash');
            setTimeout(() => cell.classList.remove('success-flash'), 1000);

        } catch (error) { 
            // Correction: Remplacer alert()
            showAlert('Error updating key: ' + error.message); 
            cell.classList.remove('loading');
            // Revert text to previous value (simplified revert for this example)
            cell.textContent = updates.newHwid !== undefined ? (row.dataset.hwid || 'Not Set') : formatTimeRemaining(row.dataset.expiresAt);
        }
    };


    // Initial Check
    const checkUserStatus = async () => {
        try {
            const response = await fetch('/api/user');
            if (response.status === 401) { showLoginView(); return; }

            const user = await response.json();
            currentUser = user; 
            
            if (user.status === 'Admin') {
                manageKeysLink.classList.remove('hidden');
            }

            // Display user info
            userNameEl.textContent = user.username;
            userAvatarEl.src = user.avatarUrl;
            userStatusBadgeEl.textContent = user.status;
            userStatusBadgeEl.className = `status-badge ${user.status.toLowerCase()}`;
            
            showAppView();
            navigateToPage('key-info'); // Start on Key Info page
            
        } catch (error) {
            console.error('Error checking user status:', error);
            showLoginView('Could not connect to the server. Please try again.');
        }
    };

    const showAppView = () => {
        loginContainer.classList.add('hidden');
        mainAppContainer.classList.remove('hidden');
    };

    const showLoginView = (message = null) => {
        mainAppContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
        if (message) {
            loginError.textContent = message;
            loginError.classList.remove('hidden');
        } else {
            loginError.classList.add('hidden');
        }
    };

    checkUserStatus();
});
