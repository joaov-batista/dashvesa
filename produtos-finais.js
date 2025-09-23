import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, addDoc, getDoc, query, orderBy, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDpxhNK75nZAR9l2HK4R3CsyQTurNzf40w",
    authDomain: "vespadash-d6d59.firebaseapp.com",
    projectId: "vespadash-d6d59",
    storageBucket: "vespadash-d6d59.appspot.com",
    messagingSenderId: "752787384693",
    appId: "1:752787384693:web:ae76ca5dfa5ce944584b3c",
    measurementId: "G-RREY691L75"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const finalProductsCollection = collection(db, 'final_products');
const finalProductsContainer = document.getElementById('final-products-container');
const appWrapper = document.getElementById('app-wrapper');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');

onAuthStateChanged(auth, user => {
    if (user) {
        setupFormSubmit();
        setupRealtimeListener();
        setupEventListeners();
        
        document.getElementById('user-email-display').textContent = user.email;
        document.getElementById('logout-button').addEventListener('click', () => signOut(auth));

        const navMenuBtn = document.getElementById('nav-menu-btn');
        const navDropdown = document.getElementById('nav-dropdown');
        navMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); navDropdown.classList.toggle('hidden'); });
        document.addEventListener('click', () => { if (!navDropdown.classList.contains('hidden')) navDropdown.classList.add('hidden'); });
    } else { window.location.href = 'index.html'; }
});

let sidebarCollapsed = false;
toggleSidebarBtn.addEventListener('click', () => {
    sidebarCollapsed = !sidebarCollapsed;
    appWrapper.classList.toggle('sidebar-collapsed', sidebarCollapsed);
    toggleSidebarBtn.textContent = sidebarCollapsed ? '»' : '«';
});

function setupRealtimeListener() {
    const q = query(finalProductsCollection, orderBy("createdAt", "desc"));
    onSnapshot(q, snapshot => {
        finalProductsContainer.innerHTML = '';
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            finalProductsContainer.appendChild(createFinalProductCard(product));
        });
    });
}

function createFinalProductCard(product) {
    const card = document.createElement('div');
    card.className = 'list final-product-card';
    card.dataset.productId = product.id;
    card.addEventListener('click', () => openViewModal(product));
    card.innerHTML = `
        <div class="list-header"><h3>${product.name}</h3></div>
        <div style="padding: 1rem; font-size: 0.9rem; flex-grow: 1;">
            <p><strong>Custo:</strong> R$ ${product.cost || 'N/A'}</p>
            <p><strong>Material:</strong> ${product.material || 'N/A'}</p>
        </div>
        <div style="padding: 0 1rem 1rem 1rem; margin-top: auto; display: flex; gap: 0.5rem;">
            <button class="filter-btn edit-btn" style="flex-grow: 1;">Editar</button>
            <button class="delete-button delete-btn" style="padding: 0.5rem 1rem;">Excluir</button>
        </div>
    `;
    return card;
}

function setupFormSubmit() {
    const form = document.getElementById('new-final-product-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = form.querySelector('#final-name').value.trim();
        const driveLink = form.querySelector('#final-drive-link').value.trim();
        if (!name || !driveLink) {
            alert('Preencha o Nome e o Link da Pasta do Drive.');
            return;
        }
        await addDoc(finalProductsCollection, {
            name,
            driveLink,
            kg: form.querySelector('#final-kg').value || '',
            dimensions: form.querySelector('#final-dimensions').value || '',
            material: form.querySelector('#final-material').value || '',
            colors: form.querySelector('#final-colors').value || '',
            cost: form.querySelector('#final-cost').value || '',
            createdAt: new Date()
        });
        form.reset();
        alert('Produto final adicionado com sucesso!');
    });
}

const viewModal = document.getElementById('view-product-modal');
const editModal = document.getElementById('edit-product-modal');
const editForm = document.getElementById('edit-product-form');
let currentEditingProductId = null;

function openViewModal(product) {
    document.getElementById('view-final-name').textContent = product.name;
    const driveLinkEl = document.getElementById('view-final-drive-link');
    driveLinkEl.href = product.driveLink;
    driveLinkEl.textContent = "Abrir Link";
    document.getElementById('view-final-cost').textContent = product.cost || 'N/A';
    document.getElementById('view-final-kg').textContent = product.kg || 'N/A';
    document.getElementById('view-final-dimensions').textContent = product.dimensions || 'N/A';
    document.getElementById('view-final-material').textContent = product.material || 'N/A';
    document.getElementById('view-final-colors').textContent = product.colors || 'N/A';
    viewModal.classList.remove('hidden');
}

async function openEditModal(productId) {
    const docRef = doc(db, 'final_products', productId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;
    const product = docSnap.data();
    currentEditingProductId = productId;
    editForm.querySelector('#edit-final-name').value = product.name;
    editForm.querySelector('#edit-final-drive-link').value = product.driveLink;
    editForm.querySelector('#edit-final-kg').value = product.kg || '';
    editForm.querySelector('#edit-final-dimensions').value = product.dimensions || '';
    editForm.querySelector('#edit-final-material').value = product.material || '';
    editForm.querySelector('#edit-final-colors').value = product.colors || '';
    editForm.querySelector('#edit-final-cost').value = product.cost || '';
    editModal.classList.remove('hidden');
}

async function saveProductChanges(e) {
    e.preventDefault();
    if (!currentEditingProductId) return;
    const productRef = doc(db, 'final_products', currentEditingProductId);
    const updatedData = {
        name: editForm.querySelector('#edit-final-name').value.trim(),
        driveLink: editForm.querySelector('#edit-final-drive-link').value.trim(),
        kg: editForm.querySelector('#edit-final-kg').value,
        dimensions: editForm.querySelector('#edit-final-dimensions').value,
        material: editForm.querySelector('#edit-final-material').value,
        colors: editForm.querySelector('#edit-final-colors').value,
        cost: editForm.querySelector('#edit-final-cost').value,
    };
    await updateDoc(productRef, updatedData);
    editModal.classList.add('hidden');
    alert('Produto atualizado com sucesso!');
}

async function deleteFinalProduct(productId) {
    const docRef = doc(db, 'final_products', productId);
    const docSnap = await getDoc(docRef);
    const productName = docSnap.exists() ? docSnap.data().name : "este produto";
    if (confirm(`Tem certeza que deseja excluir "${productName}"?`)) {
        await deleteDoc(docRef);
    }
}

function setupEventListeners() {
    finalProductsContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.final-product-card');
        if (!card) return;
        const productId = card.dataset.productId;
        if (e.target.classList.contains('edit-btn') || e.target.classList.contains('delete-btn')) {
            e.stopPropagation();
            if (e.target.classList.contains('edit-btn')) { openEditModal(productId); }
            if (e.target.classList.contains('delete-btn')) { deleteFinalProduct(productId); }
        }
    });
    viewModal.querySelector('.modal-close-btn').addEventListener('click', () => viewModal.classList.add('hidden'));
    editModal.querySelector('.modal-close-btn').addEventListener('click', () => editModal.classList.add('hidden'));
    editForm.addEventListener('submit', saveProductChanges);
}
