const STORAGE_KEY = 'money-tracker-transactions';
const categories = {
    expense: ['Food & Dining', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Other'],
    income: ['Salary', 'Freelance', 'Business', 'Investment', 'Gift', 'Other'],
};

const transactionList = document.getElementById('transactionList');
const transactionForm = document.getElementById('transactionForm');
const transactionModal = document.getElementById('transactionModal');
const transactionType = document.getElementById('transactionType');
const transactionCategory = document.getElementById('transactionCategory');
const categoryFilter = document.getElementById('categoryFilter');
const notification = document.getElementById('notification');
let notificationTimeout;
let transactions = loadTransactions();
let editingId = null;

function loadTransactions() {
    try {
        const savedTransactions = localStorage.getItem(STORAGE_KEY);
        if (!savedTransactions) return [];

        const parsedTransactions = JSON.parse(savedTransactions);
        if (!Array.isArray(parsedTransactions)) throw new Error('Saved transactions are not a list.');

        return parsedTransactions.filter((item) =>
            item &&
            typeof item.id === 'string' &&
            (item.type === 'income' || item.type === 'expense') &&
            Number.isFinite(item.amount) &&
            item.amount > 0 &&
            typeof item.category === 'string' &&
            typeof item.description === 'string' &&
            typeof item.date === 'string'
        );
    } catch (error) {
        console.error('Could not load saved transactions:', error);
        showNotification('Saved transactions could not be loaded. You can still add new ones.');
        return [];
    }
}

function saveTransactions() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
        return true;
    } catch (error) {
        console.error('Could not save transactions:', error);
        showNotification('Could not save changes in this browser. Check your storage settings.');
        return false;
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
}

function formatDate(date) {
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function getLocalDate() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function updateCategoryOptions() {
    const selectedCategory = transactionCategory.value;
    transactionCategory.replaceChildren();

    categories[transactionType.value].forEach((category) => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        transactionCategory.append(option);
    });

    if (categories[transactionType.value].includes(selectedCategory)) {
        transactionCategory.value = selectedCategory;
    }
}

function updateCategoryFilter() {
    const selectedCategory = categoryFilter.value;
    categoryFilter.replaceChildren();
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All categories';
    categoryFilter.append(allOption);

    categories.expense.forEach((category) => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.append(option);
    });

    categoryFilter.value = selectedCategory;
}

function updateSummary() {
    const income = transactions
        .filter((transaction) => transaction.type === 'income')
        .reduce((total, transaction) => total + transaction.amount, 0);
    const expenses = transactions
        .filter((transaction) => transaction.type === 'expense')
        .reduce((total, transaction) => total + transaction.amount, 0);

    document.getElementById('incomeTotal').textContent = formatCurrency(income);
    document.getElementById('expenseTotal').textContent = formatCurrency(expenses);
    document.getElementById('balanceTotal').textContent = formatCurrency(income - expenses);
}

function renderTransactions() {
    transactionList.replaceChildren();
    const visibleTransactions = transactions
        .filter((transaction) =>
            !categoryFilter.value ||
            (transaction.type === 'expense' && transaction.category === categoryFilter.value)
        )
        .sort((a, b) => b.date.localeCompare(a.date));

    visibleTransactions.forEach((transaction) => {
        const row = document.createElement('tr');
        const dateCell = document.createElement('td');
        dateCell.textContent = formatDate(transaction.date);
        const descriptionCell = document.createElement('td');
        descriptionCell.className = 'description-cell';
        descriptionCell.textContent = transaction.description;
        const categoryCell = document.createElement('td');
        categoryCell.textContent = transaction.category;
        const typeCell = document.createElement('td');
        const typeBadge = document.createElement('span');
        typeBadge.className = `type-badge ${transaction.type}`;
        typeBadge.textContent = transaction.type === 'income' ? 'Income' : 'Expense';
        typeCell.append(typeBadge);
        const amountCell = document.createElement('td');
        amountCell.className = `amount-cell ${transaction.type}`;
        amountCell.textContent = `${transaction.type === 'income' ? '+' : '−'}${formatCurrency(transaction.amount)}`;
        const actionCell = document.createElement('td');
        actionCell.className = 'actions-cell';

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'row-action';
        editButton.textContent = 'Edit';
        editButton.setAttribute('aria-label', `Edit ${transaction.description}`);
        editButton.addEventListener('click', () => openModal(transaction));

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'row-action delete-action';
        deleteButton.textContent = 'Delete';
        deleteButton.setAttribute('aria-label', `Delete ${transaction.description}`);
        deleteButton.addEventListener('click', () => deleteTransaction(transaction.id));

        actionCell.append(editButton, deleteButton);
        row.append(dateCell, descriptionCell, categoryCell, typeCell, amountCell, actionCell);
        transactionList.append(row);
    });

    const hasTransactions = visibleTransactions.length > 0;
    document.getElementById('emptyState').hidden = hasTransactions;
    document.querySelector('.transaction-table').hidden = !hasTransactions;
    document.getElementById('emptyHeading').textContent = transactions.length
        ? 'No matching transactions'
        : 'No transactions yet';
    document.getElementById('emptyDescription').textContent = transactions.length
        ? 'Try another category or choose all categories.'
        : 'Add your first income or expense to get started.';
}

function render() {
    updateSummary();
    updateCategoryFilter();
    renderTransactions();
}

function openModal(transaction = null) {
    editingId = transaction ? transaction.id : null;
    transactionForm.reset();
    transactionType.value = transaction ? transaction.type : 'expense';
    updateCategoryOptions();

    if (transaction) {
        transactionCategory.value = transaction.category;
        document.getElementById('transactionAmount').value = transaction.amount;
        document.getElementById('transactionDescription').value = transaction.description;
        document.getElementById('transactionDate').value = transaction.date;
    } else {
        document.getElementById('transactionDate').value = getLocalDate();
    }

    const title = editingId ? 'Edit transaction' : 'Add transaction';
    document.getElementById('modalHeading').textContent = title;
    document.getElementById('saveButton').textContent = title;
    transactionModal.classList.add('open');
    transactionModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    document.getElementById('transactionAmount').focus();
}

function closeModal() {
    transactionModal.classList.remove('open');
    transactionModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    editingId = null;
}

function showNotification(message) {
    notification.textContent = message;
    notification.classList.add('visible');
    clearTimeout(notificationTimeout);
    notificationTimeout = setTimeout(() => notification.classList.remove('visible'), 3200);
}

function deleteTransaction(id) {
    const transaction = transactions.find((item) => item.id === id);
    if (!transaction || !window.confirm(`Delete "${transaction.description}"?`)) return;

    transactions = transactions.filter((item) => item.id !== id);
    const saved = saveTransactions();
    render();
    if (saved) showNotification('Transaction deleted.');
}

document.getElementById('addTransactionButton').addEventListener('click', () => openModal());
document.getElementById('emptyAddButton').addEventListener('click', () => openModal());
document.getElementById('closeModalButton').addEventListener('click', closeModal);
document.getElementById('cancelButton').addEventListener('click', closeModal);
transactionType.addEventListener('change', updateCategoryOptions);
categoryFilter.addEventListener('change', renderTransactions);

transactionModal.addEventListener('click', (event) => {
    if (event.target === transactionModal) closeModal();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && transactionModal.classList.contains('open')) closeModal();
});

transactionForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!transactionForm.reportValidity()) return;

    const amount = Number(document.getElementById('transactionAmount').value);
    if (!Number.isFinite(amount) || amount <= 0) {
        showNotification('Enter an amount greater than zero.');
        return;
    }

    const description = document.getElementById('transactionDescription').value.trim();
    if (!description) {
        showNotification('Enter a description for this transaction.');
        document.getElementById('transactionDescription').focus();
        return;
    }

    const existingTransaction = transactions.find((transaction) => transaction.id === editingId);
    const transaction = {
        id: editingId || (window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
        type: transactionType.value,
        amount,
        category: transactionCategory.value,
        description,
        date: document.getElementById('transactionDate').value,
    };

    if (existingTransaction) {
        transactions = transactions.map((item) => item.id === editingId ? transaction : item);
    } else {
        transactions.push(transaction);
    }

    const saved = saveTransactions();
    closeModal();
    render();
    if (saved) showNotification(existingTransaction ? 'Transaction updated.' : 'Transaction added.');
});

updateCategoryOptions();
render();
