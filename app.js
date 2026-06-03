// Local Storage for user data
const users = JSON.parse(localStorage.getItem('users')) || {};
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

// Initialize theme
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

// Toggle Theme
document.getElementById('themeToggle').addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
});

function updateThemeIcon(theme) {
    const icon = document.querySelector('.theme-icon');
    icon.textContent = theme === 'light' ? '🌙' : '☀️';
}

// Modal Management
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

// Close modals when clicking outside
document.addEventListener('click', (e) => {
    const modals = document.querySelectorAll('.modal.active');
    modals.forEach(modal => {
        if (e.target === modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
    });
});

// Sign In / Sign Up Button Listeners
document.getElementById('signInBtn').addEventListener('click', () => {
    closeModal('signUpModal');
    openModal('signInModal');
});

document.getElementById('signUpBtn').addEventListener('click', () => {
    closeModal('signInModal');
    openModal('signUpModal');
});

// Close Buttons
document.getElementById('closeSignIn').addEventListener('click', () => closeModal('signInModal'));
document.getElementById('closeSignUp').addEventListener('click', () => closeModal('signUpModal'));
document.getElementById('closeAdmin').addEventListener('click', () => closeModal('adminModal'));

// Switch Between Sign In and Sign Up
document.getElementById('switchToSignUp').addEventListener('click', (e) => {
    e.preventDefault();
    closeModal('signInModal');
    openModal('signUpModal');
});

document.getElementById('switchToSignIn').addEventListener('click', (e) => {
    e.preventDefault();
    closeModal('signUpModal');
    openModal('signInModal');
});

// Sign In Form Handler
document.getElementById('signInForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('signInEmail').value;
    const password = document.getElementById('signInPassword').value;
    const message = document.getElementById('signInMessage');

    // Check if user exists and password matches
    if (users[email] && users[email].password === password) {
        currentUser = users[email];
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        message.innerHTML = '<p style="color: var(--success-color); font-weight: 600;">✓ Sign in successful!</p>';
        setTimeout(() => {
            closeModal('signInModal');
            updateAuthUI();
            document.getElementById('signInForm').reset();
        }, 1000);
    } else {
        message.innerHTML = '<p style="color: var(--danger-color); font-weight: 600;">✗ Invalid email or password</p>';
    }
});

// Sign Up Form Handler
document.getElementById('signUpForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('signUpName').value;
    const email = document.getElementById('signUpEmail').value;
    const password = document.getElementById('signUpPassword').value;
    const confirm = document.getElementById('signUpConfirm').value;
    const message = document.getElementById('signUpMessage');

    // Validation
    if (password !== confirm) {
        message.innerHTML = '<p style="color: var(--danger-color); font-weight: 600;">✗ Passwords do not match</p>';
        return;
    }

    if (users[email]) {
        message.innerHTML = '<p style="color: var(--danger-color); font-weight: 600;">✗ Email already registered</p>';
        return;
    }

    // Create new user
    users[email] = {
        name,
        email,
        password,
        createdAt: new Date().toISOString()
    };

    localStorage.setItem('users', JSON.stringify(users));
    currentUser = users[email];
    localStorage.setItem('currentUser', JSON.stringify(currentUser));

    message.innerHTML = '<p style="color: var(--success-color); font-weight: 600;">✓ Account created successfully!</p>';
    setTimeout(() => {
        closeModal('signUpModal');
        updateAuthUI();
        document.getElementById('signUpForm').reset();
    }, 1000);
});

// Update Auth UI based on login status
function updateAuthUI() {
    const signInBtn = document.getElementById('signInBtn');
    const signUpBtn = document.getElementById('signUpBtn');
    const adminBtn = document.getElementById('adminBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (currentUser) {
        signInBtn.style.display = 'none';
        signUpBtn.style.display = 'none';
        adminBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'inline-block';
    } else {
        signInBtn.style.display = 'inline-block';
        signUpBtn.style.display = 'inline-block';
        adminBtn.style.display = 'none';
        logoutBtn.style.display = 'none';
    }
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('currentUser');
    updateAuthUI();
    closeModal('adminModal');
});

// Admin Button - Only for logged-in users
document.getElementById('adminBtn').addEventListener('click', () => {
    if (currentUser) {
        openModal('adminModal');
    }
});

// Admin Tab Navigation
document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');

        // Remove active class from all tabs
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));

        // Add active class to clicked tab
        tab.classList.add('active');
        document.querySelector(`.admin-tab-content[data-tab="${tabName}"]`).classList.add('active');
    });
});

// Search Functionality - Only works when logged in
document.getElementById('searchBtn').addEventListener('click', () => {
    if (!currentUser) {
        alert('Please sign in to perform searches');
        openModal('signInModal');
        return;
    }

    const searchQuery = document.getElementById('searchInput').value.trim();
    if (searchQuery.length > 0) {
        performSearch(searchQuery);
    }
});

// Allow Enter key in search input
document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('searchBtn').click();
    }
});

// Search Function
function performSearch(query) {
    const resultsDiv = document.getElementById('searchResults');
    const resultsList = document.getElementById('resultsList');

    // Show loading state
    resultsDiv.style.display = 'block';
    resultsList.innerHTML = '<p style="text-align: center; padding: 2rem;">🔍 Searching for: <strong>' + query + '</strong></p>';

    // Simulate API call
    setTimeout(() => {
        const mockResults = [
            {
                title: 'Case: Herrera v. Alba',
                year: '2023',
                excerpt: 'Important ruling on property rights...'
            },
            {
                title: 'Statute: Civil Code Article 430',
                year: '1950',
                excerpt: 'Rights and obligations of property owners...'
            },
            {
                title: 'Case: People v. Santos',
                year: '2022',
                excerpt: 'Criminal law precedent regarding...'
            }
        ];

        resultsList.innerHTML = mockResults.map(result => `
            <div style="padding: 1rem; border-bottom: 1px solid var(--border-color);">
                <h4 style="color: var(--primary-color); margin-bottom: 0.5rem;">${result.title}</h4>
                <p style="font-size: 0.9rem; color: var(--text-tertiary); margin-bottom: 0.5rem;">${result.year}</p>
                <p style="color: var(--text-secondary);">${result.excerpt}</p>
            </div>
        `).join('');
    }, 1000);
}

// Initialize on page load
window.addEventListener('load', () => {
    initTheme();
    updateAuthUI();
});
