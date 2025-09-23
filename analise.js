import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, addDoc, updateDoc, getDocs, query, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

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

const analysisProductsCollection = collection(db, 'analysis_products');
const mainListsCollection = collection(db, 'lists');
const appWrapper = document.getElementById('app-wrapper');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');

onAuthStateChanged(auth, user => {
    if (user) {
        setupRealtimeListener();
        setupFormSubmit();
        
        document.getElementById('user-email-display').textContent = user.email;
        document.getElementById('logout-button').addEventListener('click', () => signOut(auth));

        const navMenuBtn = document.getElementById('nav-menu-btn');
        const navDropdown = document.getElementById('nav-dropdown');
        navMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); navDropdown.classList.toggle('hidden'); });
        document.addEventListener('click', () => { if (!navDropdown.classList.contains('hidden')) navDropdown.classList.add('hidden'); });
    } else {
        window.location.href = 'index.html';
    }
});

let sidebarCollapsed = false;
toggleSidebarBtn.addEventListener('click', () => {
    sidebarCollapsed = !sidebarCollapsed;
    appWrapper.classList.toggle('sidebar-collapsed', sidebarCollapsed);
    toggleSidebarBtn.textContent = sidebarCollapsed ? '»' : '«';
});

function setupFormSubmit() {
    const form = document.getElementById('new-product-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = form.querySelector('#product-name').value.trim();
        const description = form.querySelector('#product-desc').value.trim();
        const shopeeLink = form.querySelector('#product-shopee-link').value.trim();
        const driveLink = form.querySelector('#product-drive-link').value.trim();

        // CORREÇÃO: Apenas o nome é obrigatório
        if (name) {
            await addDoc(analysisProductsCollection, {
                name,
                description,
                shopeeLink,
                driveLink,
                status: 'Pendente',
                createdAt: new Date()
            });
            form.reset();
            alert('Produto adicionado para análise!');
        } else {
            alert('É necessário preencher pelo menos o nome do produto.');
        }
    });
}

function openProductModal(product) {
    currentProduct = product;
    
    document.getElementById('modal-product-name').textContent = product.name;
    document.getElementById('modal-product-shopee-link').href = product.shopeeLink || '#';
    const driveLinkEl = document.getElementById('modal-product-drive-link');
    if (product.driveLink) {
        driveLinkEl.href = product.driveLink;
        driveLinkEl.textContent = 'Abrir no Drive';
        driveLinkEl.parentElement.style.display = 'block';
    } else {
        driveLinkEl.parentElement.style.display = 'none';
    }
    document.getElementById('modal-product-desc').textContent = product.description || 'Sem descrição.';

    if (product.status === 'Pendente') {
        decisionButtons.classList.remove('hidden');
        sendToBoardForm.classList.add('hidden');
    } else if (product.status === 'Aprovado') {
        decisionButtons.classList.add('hidden');
        sendToBoardForm.classList.remove('hidden');
        populateBoardLists();
    } else {
        decisionButtons.classList.add('hidden');
        sendToBoardForm.classList.add('hidden');
    }

    modal.classList.remove('hidden');
}

// O resto do seu analise.js (createProductCard, deleteAnalysisProduct, closeProductModal, etc.)
// permanece exatamente como na versão anterior.
// Vou colar o restante para garantir que esteja 100% completo.

function setupRealtimeListener() {
    const q = query(analysisProductsCollection, orderBy("createdAt", "desc"));
    onSnapshot(q, snapshot => {
        const pendenteContainer = document.getElementById('pendente-cards');
        const aprovadoContainer = document.getElementById('aprovado-cards');
        const reprovadoContainer = document.getElementById('reprovado-cards');
        pendenteContainer.innerHTML = '';
        aprovadoContainer.innerHTML = '';
        reprovadoContainer.innerHTML = '';
        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            const cardElement = createProductCard(product);
            if (product.status === 'Aprovado') { aprovadoContainer.appendChild(cardElement); }
            else if (product.status === 'Reprovado') { reprovadoContainer.appendChild(cardElement); }
            else { pendenteContainer.appendChild(cardElement); }
        });
    });
}

function createProductCard(product) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.style.position = 'relative';
    cardEl.addEventListener('click', () => openProductModal(product));
    const titleEl = document.createElement('span');
    titleEl.textContent = product.name;
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'card-delete-btn';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.title = 'Excluir este card';
    deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteAnalysisProduct(product.id, product.name); });
    cardEl.append(titleEl, deleteBtn);
    return cardEl;
}

async function deleteAnalysisProduct(productId, productName) {
    if (confirm(`Tem certeza que deseja excluir o produto "${productName}"?`)) {
        await deleteDoc(doc(db, 'analysis_products', productId));
    }
}

let currentProduct = null;
const modal = document.getElementById('product-modal');
const decisionButtons = document.getElementById('modal-decision-buttons');
const sendToBoardForm = document.getElementById('send-to-board-form');

function closeProductModal() { modal.classList.add('hidden'); currentProduct = null; }
async function approveCurrentProduct() {
    if (!currentProduct) return;
    await updateDoc(doc(db, 'analysis_products', currentProduct.id), { status: 'Aprovado' });
    openProductModal({ ...currentProduct, status: 'Aprovado' });
}
async function reproveCurrentProduct() {
    if (!currentProduct) return;
    await updateDoc(doc(db, 'analysis_products', currentProduct.id), { status: 'Reprovado' });
    closeProductModal();
}
async function populateBoardLists() {
    const dropdown = document.getElementById('board-lists-dropdown');
    dropdown.innerHTML = '<option value="">Selecione uma lista...</option>';
    const q = query(mainListsCollection, orderBy("order"));
    const listsSnapshot = await getDocs(q);
    listsSnapshot.forEach(doc => { dropdown.innerHTML += `<option value="${doc.id}">${doc.data().name}</option>`; });
}
async function sendCardToBoard() {
    if (!currentProduct) return;
    const selectedListId = document.getElementById('board-lists-dropdown').value;
    if (!selectedListId) { alert('Selecione uma lista.'); return; }
    await addDoc(collection(db, 'cards'), { text: currentProduct.name, description: currentProduct.description, listId: selectedListId, status: 'pendente', order: Date.now() });
    alert('Card enviado para o quadro principal!');
    closeProductModal();
}

document.getElementById('modal-close-btn').addEventListener('click', closeProductModal);
document.getElementById('approve-btn').addEventListener('click', approveCurrentProduct);
document.getElementById('reprove-btn').addEventListener('click', reproveCurrentProduct);
document.getElementById('send-to-board-btn').addEventListener('click', sendCardToBoard);
