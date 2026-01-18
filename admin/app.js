// --- FIREBASE SETUP ---
// REPLACE THIS CONFIG OBJECT WITH YOUR OWN FROM FIREBASE CONSOLE
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
try {
    firebase.initializeApp(firebaseConfig);
}
catch (err) {
    console.error("Firebase Init Error (Likely missing config):", err);
}

const auth = firebase.auth();
const db = firebase.firestore();

// --- CLOUDINARY CONFIGURATION ---
const CLOUDINARY_CLOUD_NAME = "drfwtitti";
const CLOUDINARY_UPLOAD_PRESET = "prompt_uploads";

// --- ADMIN AUTHORIZATION ---
const ADMIN_EMAIL = "sithumdedirisingha@gmail.com";

// --- STATE & DOM ---
const state = {
    prompts: [],
    categories: [],
    user: null,
    editingId: null
};

// Views
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');

// Tabs
const tabs = {
    home: document.getElementById('tab-home'),
    add: document.getElementById('tab-add'),
    list: document.getElementById('tab-list'),
    categories: document.getElementById('tab-categories')
};
const navItems = document.querySelectorAll('.nav-item');

// --- AUTH LISTENER ---
auth.onAuthStateChanged(user => {
    if (user) {
        // Check if user email matches admin email
        if (user.email !== ADMIN_EMAIL) {
            loginError.textContent = `Access denied. Only ${ADMIN_EMAIL} can access this dashboard.`;
            auth.signOut(); // Sign out unauthorized user
            return;
        }

        state.user = user;
        showDashboard();
        fetchPrompts();
        fetchCategories();
    } else {
        state.user = null;
        showLogin();
    }
});

// --- AUTH FUNCTIONS ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;

    loginError.textContent = '';

    // Pre-check: Only allow admin email
    if (email !== ADMIN_EMAIL) {
        loginError.textContent = `Access denied. Only ${ADMIN_EMAIL} can access this dashboard.`;
        return;
    }

    loginBtn.textContent = 'Logging in...';
    loginBtn.disabled = true;

    try {
        await auth.signInWithEmailAndPassword(email, password);
        // onAuthStateChanged will handle redirect
    } catch (error) {
        loginError.textContent = error.message;
        loginBtn.textContent = 'Log In';
        loginBtn.disabled = false;
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    auth.signOut();
});

function showLogin() {
    loginView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
}

function showDashboard() {
    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    switchTab('home');
}

// --- NAVIGATION ---
window.switchTab = function (tabName) {
    // Hide all tabs
    Object.values(tabs).forEach(el => el.classList.add('hidden'));
    // Show selected
    tabs[tabName].classList.remove('hidden');

    // Update Nav UI
    // (Simplistic approach for demo)
    navItems.forEach(btn => btn.classList.remove('active'));
    // Find button that calls this function (approximate)
    const activeBtn = Array.from(navItems).find(btn => btn.getAttribute('onclick')?.includes(tabName));
    if (activeBtn) activeBtn.classList.add('active');

    // Refresh data if needed
    if (tabName === 'list') renderList();
    if (tabName === 'list') renderList();
    if (tabName === 'categories') renderCategoryList();
    if (tabName === 'home') renderStats();
}

// --- DATA FUNCTIONS ---

// Fetch Prompts from Firestore
function fetchPrompts() {
    console.log("Admin: Fetching prompts via .get()...");
    db.collection('prompts').get().then(snapshot => {
        state.prompts = [];
        snapshot.forEach(doc => {
            state.prompts.push({ id: doc.id, ...doc.data() });
        });

        // Update UI dynamically
        renderStats();
        renderList();
        console.log("Prompts loaded:", state.prompts.length);
        // alert("Admin: Loaded " + state.prompts.length + " prompts."); // Debug Alert

    }).catch(error => {
        console.error("Error fetching prompts:", error);
        alert("ERROR Loading Prompts:\n" + error.message);
    });
}

// Render Stats
function renderStats() {
    document.getElementById('statTotalPrompts').innerText = state.prompts.length;

    document.getElementById('statTotalPrompts').innerText = state.prompts.length;
    document.getElementById('statCategories').innerText = state.categories.length;
}

// Render List
function renderList() {
    const tbody = document.getElementById('promptsTableBody');
    tbody.innerHTML = '';

    state.prompts.forEach(prompt => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${prompt.title}</strong></td>
            <td><span class="badge">${prompt.category}</span></td>
            <td>
                <button class="action-btn edit" onclick="editPrompt('${prompt.id}')"><i class="ph ph-pencil-simple"></i></button>
                <button class="action-btn delete" onclick="deletePrompt('${prompt.id}')"><i class="ph ph-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- IMAGE PREVIEW ---
const imageInput = document.getElementById('pImage');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');

if (imageInput) {
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                previewImg.src = event.target.result;
                imagePreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            imagePreview.style.display = 'none';
        }
    });
}

// --- CLOUDINARY UPLOAD FUNCTION ---
/**
 * Upload image to Cloudinary using unsigned upload
 * @param {File} file - The image file to upload
 * @returns {Promise<string>} - The secure_url of the uploaded image
 */
async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
            method: "POST",
            body: formData
        }
    );

    const data = await res.json();

    if (!res.ok) {
        console.error("Cloudinary error:", data);
        throw new Error(data?.error?.message || "Upload failed");
    }

    return data.secure_url;
}

// --- CRUD ---

const promptForm = document.getElementById('promptForm');

// Edit Prompt (Setup Form)
window.editPrompt = function (id) {
    const prompt = state.prompts.find(p => p.id === id);
    if (!prompt) return;

    state.editingId = id;
    document.getElementById('formTitle').innerText = 'Edit Prompt';

    // Fill Fields
    document.getElementById('pTitle').value = prompt.title;
    document.getElementById('pCategory').value = prompt.category;
    document.getElementById('pDescription').value = prompt.description;
    document.getElementById('pText').value = prompt.promptText;
    document.getElementById('pTags').value = prompt.tags ? prompt.tags.join(', ') : '';

    // Show existing image if available
    if (prompt.imageUrl) {
        previewImg.src = prompt.imageUrl;
        imagePreview.style.display = 'block';
    } else {
        imagePreview.style.display = 'none';
    }

    switchTab('add');
}

// Reset Form
window.resetForm = function () {
    state.editingId = null;
    document.getElementById('formTitle').innerText = 'Add New Prompt';
    promptForm.reset();
    imagePreview.style.display = 'none';
    previewImg.src = '';
}

// Save (Create/Update)
promptForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log("Form submitted"); // Debug

    const title = document.getElementById('pTitle').value;
    const category = document.getElementById('pCategory').value;
    const description = document.getElementById('pDescription').value;
    const promptText = document.getElementById('pText').value;
    const tagsStr = document.getElementById('pTags').value;
    const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);
    const imageFile = imageInput.files[0];

    // Gradient generator (randomly or mapped)
    const gradients = [
        "linear-gradient(135deg, #1e3a8a, #3b82f6)",
        "linear-gradient(135deg, #0e7490, #22d3ee)",
        "linear-gradient(135deg, #0369a1, #38bdf8)",
        "linear-gradient(135deg, #1e1b4b, #4338ca)",
        "linear-gradient(135deg, #312e81, #6366f1)",
        "linear-gradient(135deg, #064e3b, #10b981)",
    ];
    // Just pick one based on title length or random for now
    const gradient = gradients[Math.floor(Math.random() * gradients.length)];

    const data = {
        title,
        category,
        description,
        promptText,
        tags,
        gradient: state.editingId ? (state.prompts.find(p => p.id === state.editingId).gradient || gradient) : gradient,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    console.log("Data to save:", data); // Debug

    try {
        // Upload image to Cloudinary if provided
        if (imageFile) {
            showToast('Uploading image to Cloudinary...', 'info');

            try {
                const imageUrl = await uploadToCloudinary(imageFile);
                data.imageUrl = imageUrl;
                console.log("Image uploaded to Cloudinary:", imageUrl);
            } catch (uploadError) {
                console.error("Cloudinary upload failed:", uploadError);
                showToast('Image upload failed: ' + uploadError.message, 'error');
                return; // Stop form submission if image upload fails
            }
        } else if (state.editingId) {
            // Keep existing image URL if editing and no new image
            const existingPrompt = state.prompts.find(p => p.id === state.editingId);
            if (existingPrompt && existingPrompt.imageUrl) {
                data.imageUrl = existingPrompt.imageUrl;
            }
        }

        if (state.editingId) {
            console.log("Updating doc:", state.editingId);
            await db.collection('prompts').doc(state.editingId).update(data);
            showToast('Prompt updated successfully!', 'success');
        } else {
            console.log("Adding new doc");
            await db.collection('prompts').add({
                ...data,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('New prompt added successfully!', 'success');
        }

        resetForm();
        fetchPrompts(); // Refresh List
        switchTab('list');

    } catch (err) {
        console.error("Save Error:", err);
        showToast('Error saving prompt: ' + err.message, 'error');
    }
});

// --- TOAST NOTIFICATION FUNCTION ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return; // Guard

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = '';
    if (type === 'success') icon = '<i class="ph-fill ph-check-circle" style="color:#10b981"></i>';
    if (type === 'error') icon = '<i class="ph-fill ph-warning-circle" style="color:#ef4444"></i>';
    if (type === 'info') icon = '<i class="ph-fill ph-info" style="color:#3b82f6"></i>';

    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    // Remove after 3s
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Delete
window.deletePrompt = async function (id) {
    if (confirm('Are you sure you want to delete this prompt?')) {
        try {
            console.log("Deleting doc:", id);
            await db.collection('prompts').doc(id).delete();
            showToast('Prompt Deleted Successfully', 'success');
            fetchPrompts(); // Refresh List
        } catch (err) {
            console.error("Delete Error:", err);
            showToast('Error Deleting: ' + err.message, 'error');
        }
    }
}

// --- CATEGORY MANAGEMENT ---

// Fetch Categories
function fetchCategories() {
    console.log("Admin: Fetching categories...");
    db.collection('categories').orderBy('name').get().then(snapshot => {
        state.categories = [];
        snapshot.forEach(doc => {
            state.categories.push({ id: doc.id, ...doc.data() });
        });

        // If no categories found, do NOT auto-seed. 
        // User might have intentionally deleted all.
        // if (state.categories.length === 0) {
        //     seedCategories();
        // } else {
        renderNotifications();
        // }
    }).catch(error => {
        console.error("Error fetching categories:", error);
    });
}

function renderNotifications() {
    renderCategoryList();
    populateCategoryDropdown();
    renderStats();
}

// Seed Default Categories (One-time helper)
async function seedCategories() {
    const defaults = [
        { name: 'ChatGPT', slug: 'chatgpt' },
        { name: 'Midjourney', slug: 'midjourney' },
        { name: 'Coding', slug: 'coding' },
        { name: 'Business', slug: 'business' },
        { name: 'YouTube', slug: 'youtube' },
        { name: 'Image AI', slug: 'image-ai' },
        { name: 'Academic', slug: 'academic' },
        { name: 'Writing', slug: 'writing' }
    ];

    for (const cat of defaults) {
        await db.collection('categories').add(cat);
    }
    fetchCategories();
}

// Render Category List
function renderCategoryList() {
    const tbody = document.getElementById('categoriesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    state.categories.forEach(cat => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${cat.name}</strong></td>
            <td><code>${cat.slug}</code></td>
            <td>
                <button class="action-btn delete" onclick="deleteCategory('${cat.id}')"><i class="ph ph-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Populate Dropdown for Add/Edit Prompt
function populateCategoryDropdown() {
    const select = document.getElementById('pCategory');
    if (!select) return;
    const currentVal = select.value;

    select.innerHTML = '';
    state.categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.slug;
        option.innerText = cat.name;
        select.appendChild(option);
    });

    if (currentVal) select.value = currentVal;
}

// Add Category
const categoryForm = document.getElementById('categoryForm');
if (categoryForm) {
    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('catName');
        const name = nameInput.value.trim();
        if (!name) return;

        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

        // Check duplicate
        if (state.categories.some(c => c.slug === slug)) {
            showToast('Category already exists!', 'error');
            return;
        }

        try {
            await db.collection('categories').add({
                name,
                slug,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Category Added', 'success');
            nameInput.value = '';
            fetchCategories();
        } catch (err) {
            console.error("Add Cat Error:", err);
            showToast('Error: ' + err.message, 'error');
        }
    });
}

// Delete Category
window.deleteCategory = async function (id) {
    if (confirm('Delete this category? Prompts using it will not be deleted but may not appear in filters.')) {
        try {
            await db.collection('categories').doc(id).delete();
            showToast('Category Deleted', 'success');
            fetchCategories();
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    }
}

// --- MOBILE SIDEBAR TOGGLE ---
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebar = document.querySelector('.sidebar');

// Toggle sidebar function
function toggleMobileSidebar() {
    if (!sidebar) return;

    const isOpen = sidebar.classList.contains('open');

    if (isOpen) {
        closeMobileSidebar();
    } else {
        openMobileSidebar();
    }
}

function openMobileSidebar() {
    if (sidebar) sidebar.classList.add('open');
    if (sidebarOverlay) sidebarOverlay.classList.add('active');
    if (mobileMenuToggle) {
        mobileMenuToggle.innerHTML = '<i class="ph ph-x"></i>';
    }
    // Prevent body scroll when sidebar is open
    document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    if (mobileMenuToggle) {
        mobileMenuToggle.innerHTML = '<i class="ph ph-list"></i>';
    }
    // Restore body scroll
    document.body.style.overflow = '';
}

// Event Listeners for mobile menu
if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', toggleMobileSidebar);
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeMobileSidebar);
}

// Close sidebar when a nav item is clicked (on mobile)
navItems.forEach(item => {
    item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            closeMobileSidebar();
        }
    });
});

// Close sidebar on window resize if switching to desktop
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        closeMobileSidebar();
    }
});

// Close sidebar on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar?.classList.contains('open')) {
        closeMobileSidebar();
    }
});
