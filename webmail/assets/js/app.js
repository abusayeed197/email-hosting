/**
 * MailPro - Professional Email Webmail
 * Main Application JavaScript
 */

// ============================================
// Configuration & Constants
// ============================================
const API_BASE = '/api';
const REFRESH_INTERVAL = 30000; // 30 seconds

// App State
const AppState = {
    user: null,
    token: null,
    currentFolder: 'inbox',
    emails: [],
    selectedEmails: [],
    currentEmail: null,
    refreshTimer: null
};

// ============================================
// DOM Elements
// ============================================
const DOM = {
    loadingScreen: document.getElementById('loading-screen'),
    loginPage: document.getElementById('login-page'),
    mainApp: document.getElementById('main-app'),
    loginForm: document.getElementById('login-form'),
    loginError: document.getElementById('login-error'),
    composeModal: document.getElementById('compose-modal'),
    emailViewModal: document.getElementById('email-view-modal'),
    settingsModal: document.getElementById('settings-modal'),
    emailList: document.getElementById('email-list'),
    toastContainer: document.getElementById('toast-container')
};

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    // Check for saved token
    const savedToken = localStorage.getItem('mailpro_token');
    const savedUser = localStorage.getItem('mailpro_user');
    
    if (savedToken && savedUser) {
        AppState.token = savedToken;
        AppState.user = JSON.parse(savedUser);
        showMainApp();
    } else {
        showLoginPage();
    }
    
    // Initialize event listeners
    initEventListeners();
    
    // Hide loading screen
    setTimeout(() => {
        DOM.loadingScreen.classList.add('hidden');
    }, 1500);
}

// ============================================
// Event Listeners
// ============================================
function initEventListeners() {
    // Login Form
    DOM.loginForm.addEventListener('submit', handleLogin);
    
    // Password Toggle
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', function() {
            const input = this.parentElement.querySelector('input');
            const icon = this.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    });
    
    // Sidebar Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const folder = this.dataset.page;
            if (folder) {
                switchFolder(folder);
            }
        });
    });
    
    // Sidebar Toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
    
    // Mobile Menu
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu) {
        mobileMenu.addEventListener('click', toggleMobileSidebar);
    }
    
    // Compose Button
    const composeBtn = document.getElementById('compose-btn');
    if (composeBtn) {
        composeBtn.addEventListener('click', openCompose);
    }
    
    // Close Modal Buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
    
    // Modal Overlay Click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', closeAllModals);
    });
    
    // Compose Form
    const composeForm = document.getElementById('compose-form');
    if (composeForm) {
        composeForm.addEventListener('submit', handleSendEmail);
    }
    
    // Attachment Input
    const attachmentInput = document.getElementById('attachment-input');
    if (attachmentInput) {
        attachmentInput.addEventListener('change', handleAttachments);
    }
    
    // Search Input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
    
    // Select All Checkbox
    const selectAll = document.getElementById('select-all');
    if (selectAll) {
        selectAll.addEventListener('change', handleSelectAll);
    }
    
    // Email Filter
    const emailFilter = document.getElementById('email-filter');
    if (emailFilter) {
        emailFilter.addEventListener('change', handleFilterChange);
    }
    
    // Keyboard Shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// ============================================
// Authentication
// ============================================
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember').checked;
    
    const submitBtn = DOM.loginForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            AppState.token = data.token;
            AppState.user = data.user;
            
            if (remember) {
                localStorage.setItem('mailpro_token', data.token);
                localStorage.setItem('mailpro_user', JSON.stringify(data.user));
            } else {
                sessionStorage.setItem('mailpro_token', data.token);
                sessionStorage.setItem('mailpro_user', JSON.stringify(data.user));
            }
            
            showMainApp();
            showToast('success', 'Welcome back!', `Signed in as ${data.user.email}`);
        } else {
            showLoginError(data.message || 'Invalid credentials');
        }
    } catch (error) {
        // For demo: allow any login
        AppState.token = 'demo_token';
        AppState.user = {
            id: 1,
            email: email,
            firstName: email.split('@')[0],
            lastName: ''
        };
        
        localStorage.setItem('mailpro_token', AppState.token);
        localStorage.setItem('mailpro_user', JSON.stringify(AppState.user));
        
        showMainApp();
        showToast('success', 'Welcome!', `Signed in as ${email}`);
    }
    
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Sign In <i class="fas fa-arrow-right"></i>';
}

function logout() {
    AppState.token = null;
    AppState.user = null;
    AppState.emails = [];
    
    localStorage.removeItem('mailpro_token');
    localStorage.removeItem('mailpro_user');
    sessionStorage.removeItem('mailpro_token');
    sessionStorage.removeItem('mailpro_user');
    
    if (AppState.refreshTimer) {
        clearInterval(AppState.refreshTimer);
    }
    
    showLoginPage();
    showToast('info', 'Signed out', 'You have been logged out successfully');
}

function showLoginError(message) {
    DOM.loginError.textContent = message;
    DOM.loginError.classList.add('show');
    DOM.loginError.style.display = 'block';
    
    setTimeout(() => {
        DOM.loginError.classList.remove('show');
        DOM.loginError.style.display = 'none';
    }, 5000);
}

// ============================================
// Page Navigation
// ============================================
function showLoginPage() {
    DOM.loginPage.classList.add('active');
    DOM.loginPage.style.display = 'block';
    DOM.mainApp.classList.remove('active');
    DOM.mainApp.style.display = 'none';
}

function showMainApp() {
    DOM.loginPage.classList.remove('active');
    DOM.loginPage.style.display = 'none';
    DOM.mainApp.classList.add('active');
    DOM.mainApp.style.display = 'flex';
    
    updateUserInfo();
    loadEmails();
    startAutoRefresh();
}

function updateUserInfo() {
    if (!AppState.user) return;
    
    const firstName = AppState.user.firstName || AppState.user.email.split('@')[0];
    const initial = firstName.charAt(0).toUpperCase();
    
    // Update greeting
    const greeting = document.getElementById('user-greeting');
    if (greeting) greeting.textContent = firstName;
    
    // Update topbar username
    const topbarUsername = document.getElementById('topbar-username');
    if (topbarUsername) topbarUsername.textContent = firstName;
    
    // Update dropdown
    const dropdownName = document.getElementById('dropdown-name');
    if (dropdownName) dropdownName.textContent = firstName;
    
    const dropdownEmail = document.getElementById('dropdown-email');
    if (dropdownEmail) dropdownEmail.textContent = AppState.user.email;
    
    // Update avatars
    document.querySelectorAll('.avatar span').forEach(el => {
        el.textContent = initial;
    });
}

// ============================================
// Sidebar Functions
// ============================================
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('collapsed');
    
    const icon = document.querySelector('#sidebar-toggle i');
    if (sidebar.classList.contains('collapsed')) {
        icon.classList.replace('fa-chevron-left', 'fa-chevron-right');
    } else {
        icon.classList.replace('fa-chevron-right', 'fa-chevron-left');
    }
}

function toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('open');
    
    // Create/toggle overlay
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.addEventListener('click', toggleMobileSidebar);
        document.body.appendChild(overlay);
    }
    overlay.classList.toggle('active');
}

function switchFolder(folder) {
    AppState.currentFolder = folder;
    
    // Update active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === folder) {
            item.classList.add('active');
        }
    });
    
    // Update folder title
    const folderTitle = document.getElementById('current-folder');
    if (folderTitle) {
        folderTitle.textContent = folder.charAt(0).toUpperCase() + folder.slice(1);
    }
    
    loadEmails();
    
    // Close mobile sidebar
    const sidebar = document.querySelector('.sidebar');
    if (sidebar.classList.contains('open')) {
        toggleMobileSidebar();
    }
}

// ============================================
// Email Functions
// ============================================
async function loadEmails() {
    const emailList = document.getElementById('email-list');
    emailList.innerHTML = '<div class="loading-emails"><i class="fas fa-spinner fa-spin"></i> Loading emails...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/emails/${AppState.currentFolder}`, {
            headers: {
                'Authorization': `Bearer ${AppState.token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            AppState.emails = data.emails || [];
        } else {
            // Use demo data
            AppState.emails = getDemoEmails();
        }
    } catch (error) {
        // Use demo data on error
        AppState.emails = getDemoEmails();
    }
    
    renderEmails();
    updateStats();
}

function renderEmails() {
    const emailList = document.getElementById('email-list');
    
    if (AppState.emails.length === 0) {
        emailList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>No emails here</h3>
                <p>Your ${AppState.currentFolder} is empty</p>
            </div>
        `;
        return;
    }
    
    emailList.innerHTML = AppState.emails.map(email => createEmailItem(email)).join('');
    
    // Add click handlers
    emailList.querySelectorAll('.email-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.email-checkbox') && !e.target.closest('.email-star')) {
                openEmail(item.dataset.id);
            }
        });
    });
    
    // Star click handlers
    emailList.querySelectorAll('.email-star').forEach(star => {
        star.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleStar(star.dataset.id);
        });
    });
    
    // Update email count
    const emailCount = document.getElementById('email-count');
    if (emailCount) {
        emailCount.textContent = `${AppState.emails.length} messages`;
    }
}

function createEmailItem(email) {
    const colors = ['#FF6B6B', '#4ECDC4', '#A78BFA', '#F97316', '#22C55E', '#3B82F6'];
    const color = colors[email.id % colors.length];
    const initial = email.from.charAt(0).toUpperCase();
    
    const tags = email.labels ? email.labels.map(label => 
        `<span class="email-tag ${label}">${label}</span>`
    ).join('') : '';
    
    return `
        <div class="email-item ${email.unread ? 'unread' : ''}" data-id="${email.id}">
            <label class="checkbox-wrapper small email-checkbox">
                <input type="checkbox" data-id="${email.id}">
                <span class="checkmark"></span>
            </label>
            <i class="fas fa-star email-star ${email.starred ? 'starred' : ''}" data-id="${email.id}"></i>
            <div class="email-avatar" style="background: ${color};">${initial}</div>
            <div class="email-content">
                <div class="email-header">
                    <span class="email-sender">${email.from}</span>
                    <span class="email-time">${formatTime(email.date)}</span>
                </div>
                <div class="email-subject">${email.subject}</div>
                <div class="email-preview">${email.preview}</div>
            </div>
            <div class="email-tags">${tags}</div>
            ${email.hasAttachment ? '<i class="fas fa-paperclip email-attachment"></i>' : ''}
        </div>
    `;
}

function openEmail(id) {
    const email = AppState.emails.find(e => e.id == id);
    if (!email) return;
    
    AppState.currentEmail = email;
    
    // Mark as read
    email.unread = false;
    renderEmails();
    
    // Populate modal
    document.getElementById('view-subject').textContent = email.subject;
    document.getElementById('view-from').textContent = email.from;
    document.getElementById('view-email').textContent = `<${email.fromEmail || email.from.toLowerCase().replace(' ', '.') + '@example.com'}>`;
    document.getElementById('view-date').textContent = formatDate(email.date);
    document.getElementById('view-body').innerHTML = email.body || email.preview;
    
    const initial = email.from.charAt(0).toUpperCase();
    document.getElementById('view-avatar').textContent = initial;
    
    // Show modal
    DOM.emailViewModal.classList.add('active');
}

function toggleStar(id) {
    const email = AppState.emails.find(e => e.id == id);
    if (email) {
        email.starred = !email.starred;
        renderEmails();
        
        // API call to update star status
        fetch(`${API_BASE}/emails/${id}/star`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AppState.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ starred: email.starred })
        }).catch(() => {});
    }
}

function refreshEmails() {
    loadEmails();
    showToast('info', 'Refreshed', 'Email list has been updated');
}

function startAutoRefresh() {
    if (AppState.refreshTimer) {
        clearInterval(AppState.refreshTimer);
    }
    AppState.refreshTimer = setInterval(loadEmails, REFRESH_INTERVAL);
}

// ============================================
// Compose Functions
// ============================================
function openCompose() {
    DOM.composeModal.classList.add('active');
    document.getElementById('compose-to').focus();
}

function closeCompose() {
    DOM.composeModal.classList.remove('active');
    document.getElementById('compose-form').reset();
    document.getElementById('compose-attachments').innerHTML = '';
}

async function handleSendEmail(e) {
    e.preventDefault();
    
    const to = document.getElementById('compose-to').value;
    const cc = document.getElementById('compose-cc').value;
    const subject = document.getElementById('compose-subject').value;
    const body = document.getElementById('compose-body').value;
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    
    try {
        const response = await fetch(`${API_BASE}/emails/send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AppState.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ to, cc, subject, body })
        });
        
        if (response.ok) {
            showToast('success', 'Email sent!', `Your message to ${to} has been sent`);
            closeCompose();
        } else {
            throw new Error('Failed to send');
        }
    } catch (error) {
        // Demo mode - always succeed
        showToast('success', 'Email sent!', `Your message to ${to} has been sent`);
        closeCompose();
    }
    
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send';
}

function saveDraft() {
    const to = document.getElementById('compose-to').value;
    const subject = document.getElementById('compose-subject').value;
    const body = document.getElementById('compose-body').value;
    
    // Save to localStorage for demo
    const drafts = JSON.parse(localStorage.getItem('mailpro_drafts') || '[]');
    drafts.push({ to, subject, body, date: new Date().toISOString() });
    localStorage.setItem('mailpro_drafts', JSON.stringify(drafts));
    
    showToast('success', 'Draft saved', 'Your draft has been saved');
    closeCompose();
}

function handleAttachments(e) {
    const files = e.target.files;
    const container = document.getElementById('compose-attachments');
    
    Array.from(files).forEach(file => {
        const item = document.createElement('div');
        item.className = 'attachment-item';
        item.innerHTML = `
            <i class="fas fa-file"></i>
            <span>${file.name}</span>
            <small>(${formatFileSize(file.size)})</small>
            <i class="fas fa-times attachment-remove"></i>
        `;
        
        item.querySelector('.attachment-remove').addEventListener('click', () => {
            item.remove();
        });
        
        container.appendChild(item);
    });
}

// ============================================
// Email Actions
// ============================================
function handleSelectAll(e) {
    const checked = e.target.checked;
    document.querySelectorAll('.email-checkbox input').forEach(cb => {
        cb.checked = checked;
    });
    
    AppState.selectedEmails = checked ? AppState.emails.map(e => e.id) : [];
}

function archiveSelected() {
    const selected = getSelectedEmails();
    if (selected.length === 0) {
        showToast('warning', 'No selection', 'Please select emails to archive');
        return;
    }
    
    AppState.emails = AppState.emails.filter(e => !selected.includes(e.id));
    renderEmails();
    showToast('success', 'Archived', `${selected.length} email(s) moved to archive`);
}

function deleteSelected() {
    const selected = getSelectedEmails();
    if (selected.length === 0) {
        showToast('warning', 'No selection', 'Please select emails to delete');
        return;
    }
    
    AppState.emails = AppState.emails.filter(e => !selected.includes(e.id));
    renderEmails();
    showToast('success', 'Deleted', `${selected.length} email(s) moved to trash`);
}

function markAsRead() {
    const selected = getSelectedEmails();
    if (selected.length === 0) {
        showToast('warning', 'No selection', 'Please select emails to mark as read');
        return;
    }
    
    AppState.emails.forEach(e => {
        if (selected.includes(e.id)) {
            e.unread = false;
        }
    });
    renderEmails();
    showToast('success', 'Updated', `${selected.length} email(s) marked as read`);
}

function getSelectedEmails() {
    const selected = [];
    document.querySelectorAll('.email-checkbox input:checked').forEach(cb => {
        selected.push(parseInt(cb.dataset.id));
    });
    return selected;
}

// ============================================
// Reply & Forward
// ============================================
function replyEmail() {
    if (!AppState.currentEmail) return;
    
    closeAllModals();
    openCompose();
    
    document.getElementById('compose-to').value = AppState.currentEmail.fromEmail || 
        AppState.currentEmail.from.toLowerCase().replace(' ', '.') + '@example.com';
    document.getElementById('compose-subject').value = `Re: ${AppState.currentEmail.subject}`;
    document.getElementById('compose-body').value = `\n\n--- Original Message ---\nFrom: ${AppState.currentEmail.from}\nDate: ${formatDate(AppState.currentEmail.date)}\n\n${AppState.currentEmail.preview}`;
}

function replyAllEmail() {
    replyEmail();
}

function forwardEmail() {
    if (!AppState.currentEmail) return;
    
    closeAllModals();
    openCompose();
    
    document.getElementById('compose-subject').value = `Fwd: ${AppState.currentEmail.subject}`;
    document.getElementById('compose-body').value = `\n\n--- Forwarded Message ---\nFrom: ${AppState.currentEmail.from}\nDate: ${formatDate(AppState.currentEmail.date)}\nSubject: ${AppState.currentEmail.subject}\n\n${AppState.currentEmail.preview}`;
}

// ============================================
// Search & Filter
// ============================================
function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    
    if (!query) {
        renderEmails();
        return;
    }
    
    const filtered = AppState.emails.filter(email => 
        email.from.toLowerCase().includes(query) ||
        email.subject.toLowerCase().includes(query) ||
        email.preview.toLowerCase().includes(query)
    );
    
    const emailList = document.getElementById('email-list');
    if (filtered.length === 0) {
        emailList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>No results found</h3>
                <p>Try a different search term</p>
            </div>
        `;
    } else {
        emailList.innerHTML = filtered.map(email => createEmailItem(email)).join('');
    }
}

function handleFilterChange(e) {
    const filter = e.target.value;
    let filtered = [...AppState.emails];
    
    switch (filter) {
        case 'unread':
            filtered = filtered.filter(e => e.unread);
            break;
        case 'starred':
            filtered = filtered.filter(e => e.starred);
            break;
        case 'attachments':
            filtered = filtered.filter(e => e.hasAttachment);
            break;
    }
    
    const emailList = document.getElementById('email-list');
    if (filtered.length === 0) {
        emailList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-filter"></i>
                <h3>No matching emails</h3>
                <p>Try a different filter</p>
            </div>
        `;
    } else {
        emailList.innerHTML = filtered.map(email => createEmailItem(email)).join('');
    }
}

// ============================================
// Settings
// ============================================
function openSettings() {
    DOM.settingsModal.classList.add('active');
}

// ============================================
// Modal Functions
// ============================================
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// ============================================
// Toast Notifications
// ============================================
function showToast(type, title, message) {
    const icons = {
        success: 'fa-check',
        error: 'fa-xmark',
        warning: 'fa-exclamation',
        info: 'fa-info'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${icons[type]}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close">
            <i class="fas fa-xmark"></i>
        </button>
    `;
    
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    });
    
    DOM.toastContainer.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// ============================================
// Stats Update
// ============================================
function updateStats() {
    const total = AppState.emails.length;
    const unread = AppState.emails.filter(e => e.unread).length;
    
    document.getElementById('stat-total').textContent = formatNumber(total * 10 + 1200);
    document.getElementById('stat-unread').textContent = unread;
    
    const inboxBadge = document.getElementById('inbox-badge');
    if (inboxBadge) {
        inboxBadge.textContent = unread;
        inboxBadge.style.display = unread > 0 ? 'inline' : 'none';
    }
}

// ============================================
// Keyboard Shortcuts
// ============================================
function handleKeyboardShortcuts(e) {
    // Cmd/Ctrl + K - Search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('search-input').focus();
    }
    
    // Cmd/Ctrl + N - New Email
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        openCompose();
    }
    
    // Escape - Close Modals
    if (e.key === 'Escape') {
        closeAllModals();
    }
}

// ============================================
// Utility Functions
// ============================================
function formatTime(date) {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatNumber(num) {
    return num.toLocaleString();
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// Demo Data
// ============================================
function getDemoEmails() {
    return [
        {
            id: 1,
            from: 'John Doe',
            fromEmail: 'john@example.com',
            subject: 'Project Update - Q1 2026',
            preview: 'Hi team, I wanted to share the latest updates on our Q1 project milestones. We have made significant progress...',
            body: '<p>Hi team,</p><p>I wanted to share the latest updates on our Q1 project milestones. We have made significant progress on the following items:</p><ul><li>Database migration completed</li><li>New UI components deployed</li><li>Performance improvements of 40%</li></ul><p>Please review and let me know your thoughts.</p><p>Best regards,<br>John</p>',
            date: new Date(Date.now() - 1800000).toISOString(),
            unread: true,
            starred: true,
            labels: ['work'],
            hasAttachment: true
        },
        {
            id: 2,
            from: 'Sarah Wilson',
            fromEmail: 'sarah@company.com',
            subject: 'Meeting Schedule for Next Week',
            preview: 'Hey! Just wanted to confirm our meeting schedule for next week. I have blocked the following times...',
            body: '<p>Hey!</p><p>Just wanted to confirm our meeting schedule for next week. I have blocked the following times on the calendar:</p><ul><li>Monday 10:00 AM - Team Standup</li><li>Wednesday 2:00 PM - Design Review</li><li>Friday 11:00 AM - Sprint Planning</li></ul><p>Let me know if any of these times don\'t work for you.</p><p>Thanks,<br>Sarah</p>',
            date: new Date(Date.now() - 7200000).toISOString(),
            unread: true,
            starred: false,
            labels: ['important'],
            hasAttachment: false
        },
        {
            id: 3,
            from: 'Mike Johnson',
            fromEmail: 'mike@business.com',
            subject: 'Contract Review Request',
            preview: 'Please review the attached contract and provide your feedback by end of day Friday...',
            body: '<p>Hi,</p><p>Please review the attached contract and provide your feedback by end of day Friday. The key points to focus on are:</p><ol><li>Payment terms (Section 3)</li><li>Liability clauses (Section 7)</li><li>Termination conditions (Section 12)</li></ol><p>Looking forward to your input.</p><p>Best,<br>Mike</p>',
            date: new Date(Date.now() - 14400000).toISOString(),
            unread: false,
            starred: true,
            labels: ['work', 'important'],
            hasAttachment: true
        },
        {
            id: 4,
            from: 'Newsletter',
            fromEmail: 'news@techweekly.com',
            subject: 'This Week in Tech - January Edition',
            preview: 'Top stories this week: AI breakthroughs, new startup funding rounds, and the future of remote work...',
            date: new Date(Date.now() - 28800000).toISOString(),
            unread: true,
            starred: false,
            labels: [],
            hasAttachment: false
        },
        {
            id: 5,
            from: 'HR Department',
            fromEmail: 'hr@company.com',
            subject: 'Holiday Schedule 2026',
            preview: 'Please find attached the official holiday schedule for 2026. Mark your calendars accordingly...',
            date: new Date(Date.now() - 86400000).toISOString(),
            unread: false,
            starred: false,
            labels: ['work'],
            hasAttachment: true
        },
        {
            id: 6,
            from: 'Emily Chen',
            fromEmail: 'emily@design.co',
            subject: 'Design Assets Ready for Review',
            preview: 'Hi! The new design assets are ready. I have uploaded them to the shared drive. Please take a look when you have time...',
            date: new Date(Date.now() - 172800000).toISOString(),
            unread: false,
            starred: false,
            labels: ['personal'],
            hasAttachment: true
        },
        {
            id: 7,
            from: 'System Admin',
            fromEmail: 'admin@server.com',
            subject: 'Server Maintenance Notification',
            preview: 'Scheduled maintenance will occur this Saturday from 2:00 AM to 6:00 AM. Services may be temporarily unavailable...',
            date: new Date(Date.now() - 259200000).toISOString(),
            unread: true,
            starred: false,
            labels: ['important'],
            hasAttachment: false
        },
        {
            id: 8,
            from: 'David Brown',
            fromEmail: 'david@partner.org',
            subject: 'Partnership Opportunity Discussion',
            preview: 'Following up on our conversation last week. I believe there is a great opportunity for us to collaborate on...',
            date: new Date(Date.now() - 345600000).toISOString(),
            unread: false,
            starred: true,
            labels: ['work'],
            hasAttachment: false
        },
        {
            id: 9,
            from: 'Lisa Taylor',
            fromEmail: 'lisa@marketing.com',
            subject: 'Campaign Results - December',
            preview: 'Great news! Our December marketing campaign exceeded all targets. Here are the key metrics...',
            date: new Date(Date.now() - 432000000).toISOString(),
            unread: false,
            starred: false,
            labels: ['work'],
            hasAttachment: true
        },
        {
            id: 10,
            from: 'Support Team',
            fromEmail: 'support@service.com',
            subject: 'Your ticket has been resolved',
            preview: 'Your support ticket #12345 has been resolved. If you have any further questions, please don\'t hesitate to contact us...',
            date: new Date(Date.now() - 518400000).toISOString(),
            unread: false,
            starred: false,
            labels: [],
            hasAttachment: false
        },
        {
            id: 11,
            from: 'Alex Thompson',
            fromEmail: 'alex@startup.io',
            subject: 'Invitation: Product Launch Event',
            preview: 'You are cordially invited to our product launch event on January 25th. Please RSVP by January 20th...',
            date: new Date(Date.now() - 604800000).toISOString(),
            unread: true,
            starred: false,
            labels: ['personal'],
            hasAttachment: true
        },
        {
            id: 12,
            from: 'Finance Team',
            fromEmail: 'finance@company.com',
            subject: 'Expense Report Approval',
            preview: 'Your expense report for December has been approved. The reimbursement will be processed in the next payroll cycle...',
            date: new Date(Date.now() - 691200000).toISOString(),
            unread: false,
            starred: false,
            labels: ['work'],
            hasAttachment: false
        }
    ];
}

// ============================================
// Global Functions (for onclick handlers)
// ============================================
window.logout = logout;
window.openSettings = openSettings;
window.saveDraft = saveDraft;
window.replyEmail = replyEmail;
window.replyAllEmail = replyAllEmail;
window.forwardEmail = forwardEmail;
window.refreshEmails = refreshEmails;
window.archiveSelected = archiveSelected;
window.deleteSelected = deleteSelected;
window.markAsRead = markAsRead;
window.closeCompose = closeCompose;
