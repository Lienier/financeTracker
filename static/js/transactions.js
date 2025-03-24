// Format currency without peso sign
const formatCurrency = (amount) => {
    return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

// Format date for display
const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

// Load transactions
const loadTransactions = async () => {
    try {
        const response = await fetch('transactions');

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const transactions = await response.json();
        
        if (!Array.isArray(transactions)) {
            throw new Error('Invalid response format: Expected an array');
        }

        let html = '';
        for (const transaction of transactions) {
            const typeClass = transaction.type === 'income' ? 'text-success' : 'text-danger';
            const typeIcon = transaction.type === 'income' ? 'fa-arrow-up' : 'fa-arrow-down';
            
            html += `
                <tr>
                    <td>${formatDate(transaction.date)}</td>
                    <td>${transaction.description}</td>
                    <td><span class="badge bg-secondary">${transaction.category}</span></td>
                    <td>
                        <span class="${typeClass}">
                            <i class="fas ${typeIcon} me-1"></i>${transaction.type}
                        </span>
                    </td>
                    <td>
                        <span class="${typeClass}">₱${formatCurrency(transaction.amount)}</span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="editTransaction(${transaction.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteTransaction(${transaction.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>`;
        }

        document.getElementById('transaction').innerHTML = 
            html || '<tr><td colspan="6" class="text-center">No transactions found</td></tr>';

    } catch (error) {
        console.error('Error loading transactions:', error);
        document.getElementById('transaction').innerHTML =
            '<tr><td colspan="6" class="text-center text-danger">Error loading transactions</td></tr>';
    }
};


// Handle transaction form submission
document.addEventListener('DOMContentLoaded', function() {
    // Load initial transactions
    loadTransactions();

    // Set default date to today in the add transaction form
    const dateInput = document.querySelector('input[name="date"]');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }

    // Handle add transaction form
    const transactionForm = document.getElementById('transactionForm');

    if (transactionForm) {
        transactionForm.addEventListener('submit', async function(e) {
            e.preventDefault(); // Prevent default form submission
    
            let submitButton = this.querySelector("button[type='submit']");
            submitButton.disabled = true; // Disable button to prevent multiple submissions
    
            try {
                const response = await fetch('/add_transaction', {
                    method: 'POST',
                    body: new FormData(this)
                });
    
                if (response.redirected) {
                    window.location.href = response.url; // Handle redirects properly
                } else {
                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.error || 'Failed to add transaction');
                    }
    
                    loadTransactions(); // Refresh transactions after successful addition
                    bootstrap.Modal.getInstance(document.getElementById('addTransactionModal')).hide();
                    this.reset();
                    document.querySelector('input[name="date"]').valueAsDate = new Date();
                }
            } catch (error) {
                console.error('Error:', error);
                alert(error.message || 'Failed to add transaction');
            } finally {
                submitButton.disabled = false; // Re-enable button after request completes
            }
        });
    }
    

    // Handle filters
    const applyFilters = document.getElementById('applyFilters');
    if (applyFilters) {
        applyFilters.addEventListener('click', async function() {
            const type = document.getElementById('typeFilter').value;
            const category = document.getElementById('categoryFilter').value;
            const date = document.getElementById('dateFilter').value;
            
            let url = 'transactions?';
            if (type) url += `type=${type}&`;
            if (category) url += `category=${category}&`;
            if (date) url += `date=${date}`;
            
            try {
                const response = await fetch(url);
                const transactions = await response.json();
                
                let html = '';
                for (const transaction of transactions) {
                    const typeClass = transaction.type === 'income' ? 'text-success' : 'text-danger';
                    const typeIcon = transaction.type === 'income' ? 'fa-arrow-up' : 'fa-arrow-down';
                    
                    html += `
                        <tr>
                            <td>${formatDate(transaction.date)}</td>
                            <td>${transaction.description}</td>
                            <td><span class="badge bg-secondary">${transaction.category}</span></td>
                            <td>
                                <span class="${typeClass}">
                                    <i class="fas ${typeIcon} me-1"></i>${transaction.type}
                                </span>
                            </td>
                            <td>
                                <span class="${typeClass}">₱${formatCurrency(transaction.amount)}</span>
                            </td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary me-1" onclick="editTransaction(${transaction.id})">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="deleteTransaction(${transaction.id})">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>`;
                }
                
                document.getElementById('transaction').innerHTML = html || '<tr><td colspan="6" class="text-center">No transactions found</td></tr>';
            } catch (error) {
                console.error('Error:', error);
                alert('Failed to apply filters');
            }
        });
    }

    const editForm = document.getElementById('editTransactionForm');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Get the transaction ID directly from the hidden input
            const id = document.getElementById('transaction_id').value;
            if (!id) {
                console.error('No transaction ID found');
                return;
            }

            const formData = new FormData(e.target);
            const data = {
                type: formData.get('type'),
                description: formData.get('description'),
                category: formData.get('category'),
                amount: parseFloat(formData.get('amount')),
                date: formData.get('date')
            };
            
            try {
                // Make sure we include the ID in the URL
                const response = await fetch(`/edit_transaction/${id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                if (response.ok) {
                    const modal = bootstrap.Modal.getInstance(document.getElementById('editTransactionModal'));
                    if (modal) {
                        modal.hide();
                    }
                    if (typeof loadTransactions === 'function') {
                        loadTransactions();
                    }
                } else {
                    const error = await response.json();
                    alert(error.error || 'Failed to update transaction');
                }
            } catch (error) {
                console.error('Error updating transaction:', error);
                alert('Failed to update transaction');
            }
        });
    }
});

// Handle edit transaction
window.editTransaction = async function(id) {
    try {
        const response = await fetch(`/edit_transaction/${id}`);
        if (!response.ok) {
            throw new Error('Failed to load transaction');
        }
        
        const data = await response.json();
        const form = document.getElementById('editTransactionForm');
        
        if (!form) {
            throw new Error('Edit form not found');
        }
        
        // Set values safely with null checks
        const transactionIdInput = document.getElementById('transaction_id');
        if (transactionIdInput) transactionIdInput.value = data.id;
        
        // Set radio button
        const typeInput = document.getElementById(`edit-${data.type}`);
        if (typeInput) typeInput.checked = true;
        
        // Set other form fields
        const descInput = form.querySelector('[name="description"]');
        if (descInput) descInput.value = data.description;
        
        const catInput = form.querySelector('[name="category"]');
        if (catInput) catInput.value = data.category;
        
        const amountInput = form.querySelector('[name="amount"]');
        if (amountInput) amountInput.value = data.amount;
        
        const dateInput = form.querySelector('[name="date"]');
        if (dateInput) dateInput.value = data.date;
        
        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('editTransactionModal'));
        modal.show();
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to load transaction details');
    }
};

// Handle delete transaction
window.deleteTransaction = async function(id) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        try {
            const response = await fetch(`/delete_transaction/${id}`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete transaction');
            }
            
            loadTransactions();
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to delete transaction');
        }
    }
};