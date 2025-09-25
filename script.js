import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query, orderBy, writeBatch, serverTimestamp, getDocs, arrayUnion } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

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

const authContainer = document.getElementById('auth-container');
const appWrapper = document.getElementById('app-wrapper');
const sidebar = document.getElementById('sidebar');
const resizer = document.getElementById('resizer');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const boardContainer = document.getElementById('boardContainer');
const inboxForm = document.getElementById('inbox-form');
const inboxCardsContainer = document.getElementById('inbox-cards-container');
const logoutButton = document.getElementById('logout-button');
const filterContainer = document.querySelector('.filter-container');
const modal = document.getElementById('card-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const saveModalBtn = document.getElementById('save-modal-btn');
const deleteCardBtn = document.getElementById('delete-card-btn');
const obsToggleBtn = document.getElementById('obs-toggle-btn');
const obsPanel = document.getElementById('observations-panel');
const obsNotificationBadge = document.getElementById('obs-notification-badge');
const obsList = document.getElementById('obs-list');
const obsForm = document.getElementById('obs-form');
const obsInput = document.getElementById('obs-input');
const obsCloseBtn = document.getElementById('obs-close-btn');

let localState = JSON.parse(localStorage.getItem('taskflowLocalState')) || { sidebarWidth: 300, sidebarCollapsed: false, activeFilter: 'all' };
let cachedLists = [], cachedCards = [], currentEditingCard = null, draggedItem = null;
const listColors = ['green', 'blue', 'yellow'];
const STATUSES = { pendente: 'Pendente', 'em-andamento': 'Em Andamento', concluida: 'Concluída', urgente: 'Urgente' };

function saveLocalState() { localStorage.setItem('taskflowLocalState', JSON.stringify(localState)); }

onAuthStateChanged(auth, user => {
    if (user) {
        authContainer.classList.add('hidden');
        appWrapper.classList.remove('hidden');
        document.getElementById('user-email-display').textContent = user.email;
        setupRealtimeListeners();
        sidebar.style.width = `${localState.sidebarWidth}px`;
        renderAll();
        setupObservations(user);

        const navMenuBtn = document.getElementById('nav-menu-btn');
        const navDropdown = document.getElementById('nav-dropdown');
        if (navMenuBtn && navDropdown) {
            navMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); navDropdown.classList.toggle('hidden'); });
            document.addEventListener('click', () => { if (!navDropdown.classList.contains('hidden')) navDropdown.classList.add('hidden'); });
        }
    } else {
        authContainer.classList.remove('hidden');
        appWrapper.classList.add('hidden');
        if (unsubscribeLists) unsubscribeLists();
        if (unsubscribeCards) unsubscribeCards();
    }
});

document.getElementById('login-form').addEventListener('submit', async e => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, e.target['login-email'].value, e.target['login-password'].value); } catch (error) { document.getElementById('auth-error').textContent = "Email ou senha inválidos."; } });
document.getElementById('register-form').addEventListener('submit', async e => { e.preventDefault(); try { await createUserWithEmailAndPassword(auth, e.target['register-email'].value, e.target['register-password'].value); } catch (error) { document.getElementById('auth-error').textContent = "Erro ao registar."; } });
document.getElementById('toggle-auth-mode').addEventListener('click', () => { document.getElementById('login-form').classList.toggle('hidden'); document.getElementById('register-form').classList.toggle('hidden'); });
logoutButton.addEventListener('click', () => signOut(auth));

let unsubscribeLists, unsubscribeCards;
function setupRealtimeListeners() {
    if (unsubscribeLists) unsubscribeLists();
    if (unsubscribeCards) unsubscribeCards();
    const listsQuery = query(collection(db, 'lists'), orderBy('order'));
    unsubscribeLists = onSnapshot(listsQuery, listSnapshot => {
        cachedLists = listSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAll();
    });
    const cardsQuery = query(collection(db, 'cards'));
    unsubscribeCards = onSnapshot(cardsQuery, cardSnapshot => {
        cachedCards = cardSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAll();
    });
}

function renderAll() {
    appWrapper.classList.toggle('sidebar-collapsed', localState.sidebarCollapsed);
    toggleSidebarBtn.textContent = localState.sidebarCollapsed ? '»' : '«';
    renderInbox();
    renderBoard();
    updateFilterButtons();
}

function renderInbox() {
    inboxCardsContainer.innerHTML = '';
    const inboxCards = cachedCards.filter(c => c.listId === 'inbox');
    inboxCards.forEach(card => inboxCardsContainer.appendChild(createCardElement(card)));
}

function renderBoard() {
    boardContainer.innerHTML = '';
    cachedLists.forEach((list, index) => boardContainer.appendChild(createListElement(list, index)));
    boardContainer.appendChild(createAddListElement());
}

function createListElement(list, index) {
    const listEl = document.createElement('div');
    listEl.className = 'list';
    listEl.dataset.listId = list.id;
    listEl.dataset.color = listColors[index % listColors.length];
    listEl.draggable = true;
    const header = document.createElement('div');
    header.className = 'list-header';
    const titleEl = document.createElement('h3');
    titleEl.className = 'list-title editable';
    titleEl.contentEditable = true;
    titleEl.textContent = list.name;
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-list-btn';
    deleteBtn.innerHTML = '&times;';
    header.append(titleEl, deleteBtn);
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'cards-container';
    cachedCards.filter(c => c.listId === list.id).sort((a,b) => (a.order || 0) - (b.order || 0)).forEach(card => cardsContainer.appendChild(createCardElement(card)));
    listEl.addEventListener('dragstart', e => { e.stopPropagation(); draggedItem = { listId: list.id, type: 'list' }; setTimeout(() => listEl.classList.add('dragging-list'), 0); });
    listEl.addEventListener('dragend', e => listEl.classList.remove('dragging-list'));
    listEl.addEventListener('dragover', e => { e.preventDefault(); e.currentTarget.classList.add('drag-over-list'); });
    listEl.addEventListener('dragleave', e => e.currentTarget.classList.remove('drag-over-list'));
    listEl.addEventListener('drop', e => {
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over-list');
        if (!draggedItem) return;
        if (draggedItem.type === 'list' && draggedItem.listId !== list.id) { reorderLists(draggedItem.listId, list.id); }
        else if (draggedItem.type === 'card' && draggedItem.listId !== list.id) { updateDoc(doc(db, 'cards', draggedItem.cardId), { listId: list.id }); }
    });
    titleEl.addEventListener('blur', () => updateDoc(doc(db, 'lists', list.id), { name: titleEl.textContent.trim() }));
    titleEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
    deleteBtn.addEventListener('click', () => deleteList(list.id));
    listEl.append(header, cardsContainer);
    return listEl;
}

function createCardElement(card) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.cardId = card.id;
    cardEl.dataset.status = card.status || 'pendente';
    cardEl.draggable = true;
    cardEl.textContent = card.text;
    if (localState.activeFilter !== 'all' && card.status !== localState.activeFilter) { cardEl.classList.add('filtered-out'); }
    cardEl.addEventListener('click', () => openCardModal(card));
    cardEl.addEventListener('dragstart', (e) => { e.stopPropagation(); draggedItem = { cardId: card.id, listId: card.listId, type: 'card' }; setTimeout(() => cardEl.classList.add('dragging'), 0); });
    cardEl.addEventListener('dragend', () => cardEl.classList.remove('dragging'));
    return cardEl;
}

function createAddListElement() {
    const formContainer = document.createElement('div');
    formContainer.className = 'add-list-form-container';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '+ Adicionar outra lista';
    input.addEventListener('keydown', async e => {
        if (e.key === 'Enter' && input.value.trim()) {
            await addDoc(collection(db, 'lists'), { name: input.value.trim(), order: cachedLists.length });
            input.value = '';
        }
    });
    formContainer.appendChild(input);
    return formContainer;
}

function openCardModal(card) {
    currentEditingCard = card;
    document.getElementById('modal-card-title-edit').value = card.text;
    document.getElementById('modal-card-description-edit').value = card.description || '';
    const statusContainer = document.getElementById('modal-status-options');
    statusContainer.innerHTML = '';
    Object.keys(STATUSES).forEach(key => {
        const opt = document.createElement('button');
        opt.className = 'status-option';
        opt.dataset.status = key;
        opt.textContent = STATUSES[key];
        if (key === card.status) opt.classList.add('selected');
        opt.onclick = () => { statusContainer.querySelector('.selected')?.classList.remove('selected'); opt.classList.add('selected'); };
        statusContainer.appendChild(opt);
    });
    modal.classList.remove('hidden');
}

function closeCardModal() { modal.classList.add('hidden'); currentEditingCard = null; }

async function saveCardChanges() {
    if (!currentEditingCard) return;
    const newText = document.getElementById('modal-card-title-edit').value.trim();
    const newDescription = document.getElementById('modal-card-description-edit').value.trim();
    const newStatus = document.querySelector('#modal-status-options .selected')?.dataset.status || 'pendente';
    await updateDoc(doc(db, 'cards', currentEditingCard.id), { text: newText, description: newDescription, status: newStatus });
    closeCardModal();
}

async function deleteCard() {
    if (!currentEditingCard || !confirm("Tem a certeza que quer excluir este cartão?")) return;
    await deleteDoc(doc(db, 'cards', currentEditingCard.id));
    closeCardModal();
}

toggleSidebarBtn.addEventListener('click', () => {
    localState.sidebarCollapsed = !localState.sidebarCollapsed;
    saveLocalState();
    renderAll();
});

resizer.addEventListener('mousedown', () => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', () => {
        document.removeEventListener('mousemove', handleMouseMove);
        localState.sidebarWidth = sidebar.offsetWidth;
        saveLocalState();
    });
});

function handleMouseMove(e) {
    const newWidth = e.clientX;
    if (newWidth >= 250 && newWidth <= 500) { sidebar.style.width = `${newWidth}px`; }
}

async function reorderLists(draggedListId, targetListId) {
    if (draggedListId === targetListId) return;
    const draggedIndex = cachedLists.findIndex(l => l.id === draggedListId);
    const targetIndex = cachedLists.findIndex(l => l.id === targetListId);
    const batch = writeBatch(db);
    const newLists = [...cachedLists];
    const [draggedList] = newLists.splice(draggedIndex, 1);
    newLists.splice(targetIndex, 0, draggedList);
    newLists.forEach((list, index) => { batch.update(doc(db, 'lists', list.id), { order: index }); });
    await batch.commit();
}

async function deleteList(listId) {
    if (!confirm("Excluir esta lista irá apagar todos os cartões contidos nela. Tem certeza?")) return;
    const batch = writeBatch(db);
    const cardsToDelete = cachedCards.filter(c => c.listId === listId);
    cardsToDelete.forEach(card => { batch.delete(doc(db, 'cards', card.id)); });
    batch.delete(doc(db, 'lists', listId));
    await batch.commit();
}

function applyFilter(filter) {
    localState.activeFilter = filter;
    saveLocalState();
    renderAll();
}

function updateFilterButtons() {
    document.querySelectorAll('.filter-container .filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === localState.activeFilter);
    });
}

saveModalBtn.addEventListener('click', saveCardChanges);
deleteCardBtn.addEventListener('click', deleteCard);
modalCloseBtn.addEventListener('click', closeCardModal);
filterContainer.addEventListener('click', e => { if (e.target.matches('.filter-btn')) applyFilter(e.target.dataset.filter); });
inboxForm.addEventListener('submit', async e => {
    e.preventDefault();
    const title = e.target.querySelector('#inbox-title').value.trim();
    const description = e.target.querySelector('#inbox-description').value.trim();
    if (title) {
        await addDoc(collection(db, 'cards'), { text: title, description, listId: 'inbox', status: 'pendente', order: Date.now() });
        inboxForm.reset();
    }
});

function setupObservations(user) {
    const obsCollection = collection(db, 'observations');
    const q = query(obsCollection, orderBy('timestamp', 'desc'));
    onSnapshot(q, snapshot => {
        obsList.innerHTML = '';
        let hasUnread = false;
        snapshot.forEach(doc => {
            const obs = { id: doc.id, ...doc.data() };
            obsList.appendChild(createObsItem(obs, user));
            if (!obs.readBy || !obs.readBy.includes(user.uid)) {
                hasUnread = true;
            }
        });
        obsNotificationBadge.classList.toggle('hidden', !hasUnread);
    });
    obsToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        obsPanel.classList.toggle('open');
        if (obsPanel.classList.contains('open')) {
            markAllObsAsRead(user.uid);
        }
    });
    obsCloseBtn.addEventListener('click', () => {
        obsPanel.classList.remove('open');
    });
    obsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = obsInput.value.trim();
        if (text) {
            await addDoc(obsCollection, { text, author: user.email, uid: user.uid, timestamp: serverTimestamp(), readBy: [user.uid], acknowledgments: [] });
            obsInput.value = '';
        }
    });
}

function createObsItem(obs, user) {
    const item = document.createElement('div');
    item.className = 'obs-item';
    item.dataset.id = obs.id;
    const textEl = document.createElement('p');
    textEl.textContent = obs.text;
    const metaEl = document.createElement('div');
    metaEl.className = 'obs-meta';
    const date = obs.timestamp ? obs.timestamp.toDate().toLocaleString('pt-BR') : 'Enviando...';
    metaEl.textContent = `Por: ${obs.author.split('@')[0]} - ${date}`;
    const footerEl = document.createElement('div');
    footerEl.className = 'obs-footer';
    const ackListEl = document.createElement('div');
    ackListEl.className = 'acknowledgment-list';
    if (obs.acknowledgments && obs.acknowledgments.length > 0) {
        ackListEl.innerHTML = `Visto por: `;
        obs.acknowledgments.forEach(ack => {
            const ackSpan = document.createElement('span');
            ackSpan.textContent = ack.email.split('@')[0];
            ackListEl.appendChild(ackSpan);
        });
    }
    footerEl.appendChild(ackListEl);
    const hasAcknowledged = obs.acknowledgments && obs.acknowledgments.some(ack => ack.uid === user.uid);
    if (user.uid !== obs.uid) {
        const ackBtn = document.createElement('button');
        ackBtn.textContent = hasAcknowledged ? '✔ Visualizado' : 'Marcar como visto';
        ackBtn.className = 'acknowledge-btn';
        if(hasAcknowledged) {
            ackBtn.classList.add('acknowledged');
            ackBtn.disabled = true;
        }
        ackBtn.addEventListener('click', () => {
            if (!hasAcknowledged) {
                acknowledgeObservation(obs.id, user);
            }
        });
        footerEl.appendChild(ackBtn);
    }
    item.append(textEl, metaEl, footerEl);
    if (user.uid === obs.uid) {
        const actionsEl = document.createElement('div');
        actionsEl.className = 'obs-actions';
        const editBtn = document.createElement('button');
        editBtn.className = 'obs-action-btn';
        editBtn.textContent = 'Editar';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'obs-action-btn delete';
        deleteBtn.textContent = 'Excluir';
        actionsEl.append(editBtn, deleteBtn);
        // Insere as ações antes do rodapé
        item.insertBefore(actionsEl, footerEl);
        deleteBtn.addEventListener('click', () => {
            deleteObservation(obs.id);
        });
        editBtn.addEventListener('click', () => {
            enterEditMode(item, textEl, actionsEl, footerEl);
        });
    }
    return item;
}

function enterEditMode(item, textEl, actionsEl, footerEl) {
    const originalText = textEl.textContent;
    const editTextArea = document.createElement('textarea');
    editTextArea.value = originalText;
    editTextArea.className = 'form-input obs-edit-textarea';
    editTextArea.rows = 4;
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Salvar';
    saveBtn.className = 'obs-action-btn';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.className = 'obs-action-btn delete';
    const editActions = document.createElement('div');
    editActions.className = 'obs-actions';
    editActions.append(saveBtn, cancelBtn);
    textEl.classList.add('hidden');
    actionsEl.classList.add('hidden');
    footerEl.classList.add('hidden');
    item.insertBefore(editTextArea, actionsEl);
    item.insertBefore(editActions, actionsEl);
    cancelBtn.addEventListener('click', () => {
        item.removeChild(editTextArea);
        item.removeChild(editActions);
        textEl.classList.remove('hidden');
        actionsEl.classList.remove('hidden');
        footerEl.classList.remove('hidden');
    });
    saveBtn.addEventListener('click', async () => {
        const newText = editTextArea.value.trim();
        if (newText && newText !== originalText) {
            const obsRef = doc(db, 'observations', item.dataset.id);
            await updateDoc(obsRef, { text: newText });
        }
        cancelBtn.click();
    });
}

async function deleteObservation(obsId) {
    if (confirm("Tem certeza que deseja excluir esta observação?")) {
        await deleteDoc(doc(db, 'observations', obsId));
    }
}

async function acknowledgeObservation(obsId, user) {
    const obsRef = doc(db, 'observations', obsId);
    await updateDoc(obsRef, {
        acknowledgments: arrayUnion({
            uid: user.uid,
            email: user.email
        })
    });
}

async function markAllObsAsRead(userId) {
    const obsCollection = collection(db, 'observations');
    const q = query(obsCollection);
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.forEach(doc => {
        const obs = doc.data();
        if (!obs.readBy || !obs.readBy.includes(userId)) {
            const newReadBy = obs.readBy ? [...obs.readBy, userId] : [userId];
            batch.update(doc.ref, { readBy: newReadBy });
        }
    });
    await batch.commit();
}
