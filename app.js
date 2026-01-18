// --- FIREBASE SETUP ---
// REPLACE WITH YOUR CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyB2fzdOYzE1E0rSHyCzbLBYg-s_ikipOd0",
    authDomain: "promptix-9fee0.firebaseapp.com",
    projectId: "promptix-9fee0",
    storageBucket: "promptix-9fee0.firebasestorage.app",
    messagingSenderId: "313250506618",
    appId: "1:313250506618:web:81f10265b4856019fbd8c3",
    measurementId: "G-NW8JE9RTYX"
};

// Initialize Firebase
let db = null;

try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
    } else {
        console.warn("Firebase SDK not loaded. App will run in offline/UI-only mode.");
    }
} catch (err) {
    console.error("Firebase Init Error:", err);
}

// App State
let promptsData = []; // Will be fetched from DB
let categoriesData = [];
let currentCategory = 'all';
let searchQuery = '';
let displayedCount = 6;
const LOAD_INCREMENT = 6;

// DOM Elements
const promptsGrid = document.getElementById('promptsGrid');
const categoryFilters = document.getElementById('categoryFilters');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const filterBtns = document.querySelectorAll('.filter-btn');
const loadMoreBtn = document.getElementById('loadMore');
const mobileToggle = document.getElementById('mobileToggle');
const mainNav = document.getElementById('mainNav');

// --- Functions ---

/**
 * Initialize the App
 */
function init() {
    console.log("App Init - Page:", getCurrentPage());

    // Initialize 10-Minute Unlock Gate (FIRST-VISIT LOCK)
    UnlockSystem.init();

    // Read URL parameters for category filtering
    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get('category');
    if (categoryParam) {
        currentCategory = categoryParam;
        console.log("URL Category Filter:", currentCategory);
    }

    setupEventListeners();
    fetchCategories();
    fetchPrompts();

    // Update UI to show active filter
    updateFilterUI();
}

// --- 10-MINUTE AD UNLOCK GATE SYSTEM ---
const AD_UNLOCK_KEY = 'promptix_ad_unlock_expiry';
const AD_LINK = 'https://www.effectivegatecpm.com/wxrmreff3?key=f97d877faf43de8fd1bce7da9590900b';
const UNLOCK_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

const UnlockSystem = {
    /**
     * Check if the site is currently unlocked
     * @returns {boolean} True if unlocked and not expired
     */
    isUnlocked: function () {
        const expiry = localStorage.getItem(AD_UNLOCK_KEY);
        if (!expiry) return false;
        return Date.now() < parseInt(expiry, 10);
    },

    /**
     * Unlock the site for 10 minutes
     */
    unlock: function () {
        const expiry = Date.now() + UNLOCK_DURATION;
        localStorage.setItem(AD_UNLOCK_KEY, expiry);
        console.log('Site unlocked for 10 minutes');
    },

    /**
     * Show the full-screen unlock gate
     */
    showGate: function () {
        let overlay = document.getElementById('unlockGateOverlay');

        // Create gate if it doesn't exist
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'unlockGateOverlay';
            overlay.className = 'unlock-gate-overlay';
            overlay.innerHTML = `
                <div class="unlock-gate">
                    <div class="unlock-icon"><i class="ph-fill ph-lock-key"></i></div>
                    <h1 class="unlock-gate-title">Welcome to Promptix.live</h1>
                    <p class="unlock-gate-desc">Watch a short ad to unlock full access for 10 minutes</p>
                    <button class="btn-unlock-gate" id="btnUnlockGate">
                        <i class="ph-fill ph-play-circle"></i> View a Short Ad
                    </button>
                    <p class="unlock-gate-note">One-time unlock • Free forever • Supports our platform</p>
                </div>
            `;
            document.body.appendChild(overlay);

            // Attach event listener
            const btn = document.getElementById('btnUnlockGate');
            btn.addEventListener('click', () => {
                // Open ad in new tab (user-initiated)
                window.open(AD_LINK, '_blank');

                // Unlock for 10 minutes
                UnlockSystem.unlock();

                // Hide the gate
                overlay.remove();
            });
        }

        // Show the gate
        overlay.style.display = 'flex';
    },

    /**
     * Initialize the unlock system on page load
     * Shows gate if not unlocked or expired
     */
    init: function () {
        if (!this.isUnlocked()) {
            // Show gate immediately on first visit or after expiry
            this.showGate();
        }
    }
};

/**
 * Fetch Categories
 */
function fetchCategories() {
    if (!db) return; // Skip if DB not initialized

    db.collection('categories').orderBy('name').get().then(snapshot => {
        categoriesData = [];
        snapshot.forEach(doc => {
            categoriesData.push({ id: doc.id, ...doc.data() });
        });
        renderCategories(); // Renders filter pills
        if (getCurrentPage() === 'categories') renderAllCategoriesGrid();
        updateFilterUI(); // Update UI after categories are loaded (for name resolution)
    }).catch(error => {
        console.error("Error fetching categories:", error);
    });
}

function renderCategories() {
    if (!categoryFilters) return;
    categoryFilters.innerHTML = '';

    categoriesData.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.setAttribute('data-category', cat.slug);
        btn.innerText = cat.name;

        btn.addEventListener('click', () => {
            // UI Update
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Logic Update
            currentCategory = cat.slug;
            displayedCount = LOAD_INCREMENT;
            renderPrompts();
        });

        categoryFilters.appendChild(btn);
    });
}

/**
 * Fetch Prompts from Firestore
 */
function fetchPrompts() {
    // Show Loading
    if (promptsGrid) promptsGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">Checking Database...</div>';

    // db.collection('prompts').onSnapshot(snapshot => {
    // Switch to .get() for stability checks
    console.log("Fetching prompts via .get()...");

    if (!db) {
        if (promptsGrid) promptsGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">Offline Mode: Database not connected.</div>';
        return;
    }

    db.collection('prompts').get().then(snapshot => {
        promptsData = [];
        snapshot.forEach(doc => {
            promptsData.push({ id: doc.id, ...doc.data() });
        });

        console.log("Fetch Complete. Count:", promptsData.length);
        // alert("Public Site: Found " + promptsData.length + " prompts."); // Debug Alert

        if (promptsData.length === 0) {
            if (promptsGrid) promptsGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">No prompts found in Database. Please add some via Admin Dashboard.</div>';
        }

        renderPrompts(); // Logic inside checks page
        if (getCurrentPage() === 'popular') renderPopularPrompts();
    }).catch(error => {
        console.error("Error fetching prompts:", error);
        if (promptsGrid) promptsGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:red;">Error connecting to database.<br>${error.message}</div>`;
    });
}

/**
 * Render Prompts to the Grid
 */
function renderPrompts() {
    if (!promptsGrid) return; // Null-safe check
    promptsGrid.innerHTML = '';

    // Determine limit based on Page
    const page = getCurrentPage();
    const isHome = page === 'home';

    // Config: Home shows 8, others use pagination
    const limit = isHome ? 8 : displayedCount;

    // Filter Logic
    const filtered = promptsData.filter(prompt => {
        const matchesCategory = currentCategory === 'all' || prompt.category === currentCategory;
        const matchesSearch = (prompt.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (prompt.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (prompt.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    if (filtered.length === 0) {
        promptsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: var(--text-tertiary); padding: 40px;">
                <h3>No prompts found</h3>
                <p>Try adjusting your search or filters.</p>
            </div>
        `;
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        return;
    }

    // Pagination/Limit Logic
    const visiblePrompts = filtered.slice(0, limit);

    // Toggle Load More Button
    if (loadMoreBtn) {
        if (isHome) {
            loadMoreBtn.style.display = 'none'; // No "Load More" on Home, use "View All" link in HTML
        } else {
            if (filtered.length > displayedCount) {
                loadMoreBtn.style.display = 'inline-flex';
            } else {
                loadMoreBtn.style.display = 'none';
            }
        }
    }

    // Generate Cards
    visiblePrompts.forEach(prompt => {
        const card = document.createElement('article');
        card.className = 'prompt-card';

        // Add Click Listener for Preview Page
        card.onclick = (e) => {
            // Prevent if clicking copy button
            if (e.target.closest('.copy-btn')) return;
            openPreview(prompt);
        };

        // 1. Image or Fallback Gradient
        let mediaHtml;
        if (prompt.imageUrl) {
            mediaHtml = `<img src="${prompt.imageUrl}" class="card-image-bg" alt="${prompt.title}" loading="lazy">`;
        } else {
            // Fallback gradient if no image
            const fallbackGradient = prompt.gradient || 'linear-gradient(135deg, #1e3a8a, #3b82f6)';
            mediaHtml = `<div class="card-image-bg" style="background: ${fallbackGradient}"></div>`;
        }

        card.innerHTML = `
            ${mediaHtml}
            <div class="card-overlay"></div>
            
            <div class="card-content">
                <h3 class="card-title">${prompt.title}</h3>
                <p class="card-preview">${prompt.description || prompt.promptText}</p>
                
                <button class="copy-btn" onclick="copyPromptText(this); event.stopPropagation();">
                    <i class="ph ph-copy"></i> Copy Prompt
                </button>
                
                <div class="prompt-text" style="display: none;">${prompt.promptText}</div>
            </div>
        `;
        promptsGrid.appendChild(card);
    });
}

// --- Preview Page Logic (SPA Modal Style) ---
const previewPage = document.getElementById('previewPage');
const previewBackBtn = document.getElementById('previewBackBtn');

// Elements to populate
const previewImage = document.getElementById('previewImage');
const previewTitle = document.getElementById('previewTitle');
const previewPromptText = document.getElementById('previewPromptText');
const previewCopyBtn = document.getElementById('previewCopyBtn');

function openPreview(prompt) {
    if (!previewPage) return;

    // Populate Data
    previewTitle.textContent = prompt.title;
    previewPromptText.textContent = prompt.promptText;

    // Image Handling
    if (prompt.imageUrl) {
        previewImage.src = prompt.imageUrl;
    } else {
        // Fallback for text-only prompts
        previewImage.src = 'https://via.placeholder.com/600x600?text=No+Image'; // Placeholder
    }

    // Show Page (SPA Transition)
    previewPage.classList.add('active');
    document.body.style.overflow = 'hidden'; // Lock main scroll

    // Push History State (Optional, for back button support)
    window.history.pushState({ preview: true }, '');

    // Setup Copy Button
    previewCopyBtn.onclick = () => {
        navigator.clipboard.writeText(prompt.promptText).then(() => {
            const originalText = previewCopyBtn.innerHTML;
            previewCopyBtn.innerHTML = '<i class="ph-fill ph-check-circle"></i> Copied!';
            previewCopyBtn.style.background = '#16a34a'; // Green

            setTimeout(() => {
                previewCopyBtn.innerHTML = originalText;
                previewCopyBtn.style.background = ''; // Revert to default
            }, 2000);
        });
    };
}

function closePreview() {
    if (!previewPage) return;
    previewPage.classList.remove('active');
    document.body.style.overflow = ''; // Unlock scroll
}

// Event Listeners for Preview
if (previewBackBtn) previewBackBtn.addEventListener('click', () => {
    closePreview();
    if (window.history.state && window.history.state.preview) window.history.back();
});

// Handle Browser Back Button
window.addEventListener('popstate', (event) => {
    if (previewPage && previewPage.classList.contains('active')) {
        closePreview();
    }
});

/**
 * Handle Copy Function - Copies only the prompt text
 */
window.copyPromptText = async function (btn) {
    const card = btn.closest('.prompt-card');
    const promptTextElement = card.querySelector('.prompt-text');

    if (!promptTextElement) {
        console.error('Prompt text element not found');
        btn.innerText = 'Error';
        return;
    }

    const text = promptTextElement.textContent;

    try {
        await navigator.clipboard.writeText(text);

        // Visual Feedback
        const originalContent = btn.innerHTML;
        btn.innerHTML = `<i class="ph-fill ph-check-circle"></i> Copied!`;
        btn.classList.add('copied');

        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.classList.remove('copied');
        }, 2000);

    } catch (err) {
        console.error('Failed to copy:', err);
        btn.innerText = 'Error';
    }
}

/**
 * Handle Copy Function (Legacy support)
 */
window.copyPrompt = async function (encodedText, btn) {
    const text = decodeURIComponent(encodedText);

    try {
        await navigator.clipboard.writeText(text);
        const originalContent = btn.innerHTML;
        btn.innerHTML = `<i class="ph-fill ph-check-circle"></i> Copied!`;
        btn.classList.add('copied');

        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.classList.remove('copied');
        }, 2000);

    } catch (err) {
        console.error('Failed to copy class', err);
        btn.innerText = 'Error';
    }
}

// --- Multi-Page Logic ---

function getCurrentPage() {
    const path = window.location.pathname;
    if (path.includes('categories.html')) return 'categories';
    if (path.includes('popular.html')) return 'popular';
    if (path.includes('prompts.html')) return 'prompts';
    if (path.includes('how-it-works.html')) return 'how-it-works';
    return 'home';
}

// --- Category Grid Logic ---
const allCategoriesGrid = document.getElementById('allCategoriesGrid');
const categorySearchInput = document.getElementById('categorySearchInput');

function renderAllCategoriesGrid(filter = '') {
    if (!allCategoriesGrid) return;
    allCategoriesGrid.innerHTML = '';

    const filteredCats = categoriesData.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));

    filteredCats.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'category-card-large';

        // Random Icon
        const icons = ['ph-pencil', 'ph-image', 'ph-code', 'ph-robot', 'ph-chat-circle'];
        const icon = icons[Math.floor(Math.random() * icons.length)];

        card.innerHTML = `
            <div class="cat-icon-box"><i class="ph ${icon}"></i></div>
            <span class="cat-card-name">${cat.name}</span>
            <span class="cat-card-count">Explore</span> 
        `;

        card.onclick = () => {
            // Navigate with category filter
            window.location.href = `prompts.html?category=${cat.slug}`;
        };

        allCategoriesGrid.appendChild(card);
    });
}

/**
 * Update Filter UI - shows active filter header and button states
 */
function updateFilterUI() {
    const page = getCurrentPage();
    if (page !== 'prompts') return;

    // Update page header if filtering
    const pageHeader = document.querySelector('.page-header');
    if (pageHeader && currentCategory !== 'all') {
        // Find category name from slug
        const cat = categoriesData.find(c => c.slug === currentCategory);
        const categoryName = cat ? cat.name : currentCategory;

        pageHeader.innerHTML = `
            <h1>Category: ${categoryName}</h1>
            <p>Showing prompts in this category.</p>
            <a href="prompts.html" class="clear-filter-btn">
                <i class="ph ph-x"></i> Clear Filter - View All
            </a>
        `;
    }

    // Update filter button active states
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.category === currentCategory) {
            btn.classList.add('active');
        }
    });
}

// --- Popular/Newest Logic ---
const popularPromptsGrid = document.getElementById('popularPromptsGrid');

function renderPopularPrompts() {
    if (!popularPromptsGrid) return;
    popularPromptsGrid.innerHTML = '';

    // Sort by CreatedAt Desc
    const sorted = [...promptsData].sort((a, b) => {
        if (b.createdAt && a.createdAt) return b.createdAt - a.createdAt;
        return 0;
    });

    sorted.forEach(prompt => {
        const card = createPromptCardElement(prompt);
        popularPromptsGrid.appendChild(card);
    });
}

// Helper: Extract Card Creation
function createPromptCardElement(prompt) {
    const card = document.createElement('article');
    card.className = 'prompt-card';

    card.onclick = (e) => {
        if (e.target.closest('.copy-btn')) return;
        openPreview(prompt);
    };

    let mediaHtml;
    if (prompt.imageUrl) {
        mediaHtml = `<img src="${prompt.imageUrl}" class="card-image-bg" alt="${prompt.title}" loading="lazy">`;
    } else {
        const fallbackGradient = prompt.gradient || 'linear-gradient(135deg, #1e3a8a, #3b82f6)';
        mediaHtml = `<div class="card-image-bg" style="background: ${fallbackGradient}"></div>`;
    }

    card.innerHTML = `
        ${mediaHtml}
        <div class="card-overlay"></div>
        <div class="card-content">
            <h3 class="card-title">${prompt.title}</h3>
            <p class="card-preview">${prompt.description || prompt.promptText}</p>
            <button class="copy-btn" onclick="copyPromptText(this); event.stopPropagation();">
                <i class="ph ph-copy"></i> Copy Prompt
            </button>
            <div class="prompt-text" style="display: none;">${prompt.promptText}</div>
        </div>
    `;
    return card;
}

// --- Setup Event Listeners ---
function setupEventListeners() {
    // Nav Links - managed natively by HTML hrefs now.

    // Category Search
    if (categorySearchInput) {
        categorySearchInput.addEventListener('input', (e) => {
            renderAllCategoriesGrid(e.target.value);
        });
    }

    // Categories (Static "All" button)
    const allBtn = document.querySelector('.filter-btn[data-category="all"]');
    if (allBtn) {
        allBtn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            currentCategory = 'all';
            displayedCount = LOAD_INCREMENT;
            renderPrompts();
        });
    }

    // Real-time Search
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            displayedCount = LOAD_INCREMENT;
            renderPrompts();
        });
    }

    // Load More
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            displayedCount += LOAD_INCREMENT;
            renderPrompts();
        });
    }

    // Mobile Menu Toggle
    if (mobileToggle && mainNav) {
        const toggleMenu = () => {
            const isOpen = mainNav.classList.toggle('open');
            document.body.style.overflow = isOpen ? 'hidden' : ''; // Lock scroll

            const icon = mobileToggle.querySelector('i');
            if (isOpen) {
                icon.className = 'ph ph-x';
            } else {
                icon.className = 'ph ph-list';
            }
        };

        mobileToggle.addEventListener('click', toggleMenu);

        const navCloseBtn = document.getElementById('navCloseBtn');
        if (navCloseBtn) {
            navCloseBtn.addEventListener('click', () => {
                if (mainNav.classList.contains('open')) toggleMenu();
            });
        }
    }
}

// DOMContentLoaded is handled by init call at the end? 
// Original code had `document.addEventListener('DOMContentLoaded', init);`
// I included it in the `init` function definition but I need to call it.
// Wait, I replaced `init` function definition in my large block.
// Yes, `init` is redefined at the top, and `document.addEventListener` is at the bottom.
// Wait, I have `init` defined TWICE in my proposed content?
// Line 48: `function init() {...}`
// Line ~500: I did NOT redefine init in Part 2. I used `document.addEventListener('DOMContentLoaded', init);`
// But I defined `init` at the top:
// ```javascript
// function init() {
//    console.log("App Init - Page:", getCurrentPage());
//    setupEventListeners();
//    fetchCategories();
//    fetchPrompts();
// }
// ```
// And I DON'T need to redefine it at the bottom.
// So I am set.

document.addEventListener('DOMContentLoaded', init);
