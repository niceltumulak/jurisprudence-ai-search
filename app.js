// ============================================
// JURISPRUDENCE AI SEARCH - Frontend Logic
// ============================================

const app = {
  // State Management
  state: {
    theme: localStorage.getItem('theme') || 'light',
    user: null,
    subscription: null,
    searchHistory: [],
    currentResults: [],
    isSearching: false,
  },

  // Initialize App
  init() {
    this.applyTheme(this.state.theme);
    this.attachEventListeners();
    this.checkAuthStatus();
    this.setupServiceWorker();
  },

  // ============================================
  // THEME MANAGEMENT
  // ============================================
  toggleTheme() {
    this.state.theme = this.state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', this.state.theme);
    this.applyTheme(this.state.theme);
  },

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
      toggle.textContent = theme === 'light' ? '🌙' : '☀️';
    }
  },

  // ============================================
  // AUTHENTICATION
  // ============================================
  async checkAuthStatus() {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        this.state.user = await response.json();
        this.updateAuthUI();
      }
    } catch (error) {
      console.log('Not authenticated');
    }
  },

  showAuthModal(mode) {
    const modal = document.getElementById('authModal');
    const title = document.getElementById('authModalTitle');
    const toggle = document.getElementById('authToggle');
    const nameGroup = document.getElementById('nameGroup');

    if (mode === 'signup') {
      title.textContent = 'Create Account';
      nameGroup.style.display = 'block';
      toggle.textContent = 'Already have an account? Sign In';
      modal.dataset.mode = 'signup';
    } else {
      title.textContent = 'Sign In';
      nameGroup.style.display = 'none';
      toggle.textContent = "Don't have an account? Sign Up";
      modal.dataset.mode = 'signin';
    }

    modal.classList.add('active');
  },

  closeAuthModal() {
    document.getElementById('authModal').classList.remove('active');
  },

  toggleAuthMode(event) {
    event.preventDefault();
    const mode = document.getElementById('authModal').dataset.mode;
    this.showAuthModal(mode === 'signin' ? 'signup' : 'signin');
  },

  async submitAuthForm(event) {
    event.preventDefault();
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const name = document.getElementById('authName').value;
    const mode = document.getElementById('authModal').dataset.mode;

    try {
      const endpoint = mode === 'signin' ? '/api/auth/signin' : '/api/auth/signup';
      const payload = { email, password };
      if (mode === 'signup') payload.name = name;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        this.state.user = data.user;
        localStorage.setItem('token', data.token);
        this.closeAuthModal();
        this.updateAuthUI();
      } else {
        alert('Authentication failed. Please try again.');
      }
    } catch (error) {
      console.error('Auth error:', error);
      alert('An error occurred. Please try again.');
    }
  },

  updateAuthUI() {
    const authButtons = document.querySelector('.auth-buttons');
    const subscriptionInfo = document.getElementById('subscriptionInfo');

    if (this.state.user) {
      authButtons.innerHTML = `
        <div style="display: flex; gap: 1rem; align-items: center;">
          <span style="color: var(--text-secondary);">${this.state.user.email}</span>
          <button class="btn btn-secondary" onclick="app.logout()">Logout</button>
        </div>
      `;
      subscriptionInfo.style.display = 'flex';
      this.updateSubscriptionInfo();
    } else {
      authButtons.innerHTML = `
        <button class="btn btn-secondary" onclick="app.showAuthModal('signin')">Sign In</button>
        <button class="btn btn-primary" onclick="app.showAuthModal('signup')">Sign Up</button>
      `;
      subscriptionInfo.style.display = 'none';
    }
  },

  async updateSubscriptionInfo() {
    try {
      const response = await fetch('/api/subscription/status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        this.state.subscription = data;
        document.getElementById('currentPlan').textContent = data.plan || 'Free Trial';
        document.getElementById('daysRemaining').textContent = `${data.daysRemaining} days remaining`;
      }
    } catch (error) {
      console.error('Subscription fetch error:', error);
    }
  },

  logout() {
    this.state.user = null;
    this.state.subscription = null;
    localStorage.removeItem('token');
    this.updateAuthUI();
  },

  // ============================================
  // SEARCH FUNCTIONALITY
  // ============================================
  async executeSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) {
      alert('Please enter a search query');
      return;
    }

    if (!this.state.user) {
      this.showAuthModal('signin');
      return;
    }

    this.state.isSearching = true;
    document.getElementById('resultsContainer').style.display = 'grid';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('resultsList').innerHTML = '';
    document.getElementById('resultsLoading').style.display = 'block';

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ query }),
      });

      if (response.ok) {
        const data = await response.json();
        this.state.currentResults = data.results;
        this.displaySearchResults(data.results);
        this.displayAnalysis(data.analysis);
        this.addToSearchHistory(query);
      } else {
        alert('Search failed. Please try again.');
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('An error occurred during search.');
    } finally {
      this.state.isSearching = false;
      document.getElementById('resultsLoading').style.display = 'none';
    }
  },

  displaySearchResults(results) {
    const resultsList = document.getElementById('resultsList');
    resultsList.innerHTML = '';

    if (results.length === 0) {
      resultsList.innerHTML = '<p style="color: var(--text-tertiary); text-align: center;">No results found.</p>';
      return;
    }

    results.forEach((result, index) => {
      const resultHTML = `
        <div class="result-item">
          <div class="result-title">${this.escapeHtml(result.caseTitle)}</div>
          <div class="result-meta">
            <strong>${result.grNumber}</strong> • ${new Date(result.dateOfDecision).toLocaleDateString()} • ${result.court}
          </div>
          ${result.codalProvisions
            ? `<div style="margin-bottom: 0.75rem;">
                ${result.codalProvisions.map(p => `<span class="codal-provision">${this.escapeHtml(p)}</span>`).join('')}
              </div>`
            : ''}
          <div class="result-quote">"${this.escapeHtml(result.quotedPortion)}"</div>
          <div class="result-analysis">
            <strong>Application to Your Facts:</strong><br>
            ${this.escapeHtml(result.aiAnalysis)}
          </div>
          <div style="margin-top: 1rem; font-size: 0.85rem;">
            <a href="${this.escapeHtml(result.sourceUrl)}" target="_blank" style="color: var(--color-secondary); text-decoration: none;">
              View Full Decision →
            </a>
          </div>
        </div>
      `;
      resultsList.innerHTML += resultHTML;
    });
  },

  displayAnalysis(analysis) {
    if (!analysis) return;

    document.getElementById('analysisText').textContent = analysis.summary || 'Analysis unavailable';

    const keyPoints = document.getElementById('keyPoints');
    keyPoints.innerHTML = '';
    if (analysis.keyPoints && Array.isArray(analysis.keyPoints)) {
      analysis.keyPoints.forEach(point => {
        const li = document.createElement('li');
        li.textContent = point;
        keyPoints.appendChild(li);
      });
    }

    const codalProvisionsDiv = document.getElementById('codalProvisions');
    codalProvisionsDiv.innerHTML = '';
    if (analysis.applicableProvisions && Array.isArray(analysis.applicableProvisions)) {
      analysis.applicableProvisions.forEach(provision => {
        const badge = document.createElement('span');
        badge.className = 'codal-provision';
        badge.textContent = provision;
        codalProvisionsDiv.appendChild(badge);
      });
    }
  },

  addToSearchHistory(query) {
    if (!this.state.searchHistory.includes(query)) {
      this.state.searchHistory.unshift(query);
      this.state.searchHistory = this.state.searchHistory.slice(0, 10);
    }
  },

  // ============================================
  // PAYWALL & SUBSCRIPTION
  // ============================================
  showPaywall() {
    alert('Upgrade to Pro to unlock unlimited searches. Plans:\n\n' +
          '• Pro Monthly: ₱199/month\n' +
          '• Pro Annual: ₱1,910.40/year (20% discount)\n' +
          '• 3-Day Flash Pass: ₱799\n\n' +
          'Coming soon: Integration with GCash, Maya, and local bank transfers.');
  },

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  },

  navigateTo(page) {
    console.log(`Navigating to ${page}`);
    // Placeholder for multi-page navigation
  },

  attachEventListeners() {
    const authForm = document.getElementById('authForm');
    if (authForm) {
      authForm.addEventListener('submit', e => this.submitAuthForm(e));
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') this.executeSearch();
      });
    }
  },

  setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        console.log('Service Worker registration failed (optional)');
      });
    }
  },
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => app.init());