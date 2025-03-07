document.addEventListener('DOMContentLoaded', function() {
    // Format currency without peso sign
    const formatCurrency = (amount) => {
        return amount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    // Update summary cards
    const updateSummaryCards = async () => {
        try {
            const response = await fetch('/get_summary_data');
            const data = await response.json();
            
            // Update values without peso sign (peso sign is in HTML)
            document.getElementById('total-income').textContent = formatCurrency(data.total_income);
            document.getElementById('total-expenses').textContent = formatCurrency(data.total_expenses);
            document.getElementById('balance').textContent = formatCurrency(data.balance);
        } catch (error) {
            console.error('Error fetching summary data:', error);
        }
    };

    // Update category tables
    const updateCategoryTables = async () => {
        try {
            // Update income categories
            const incomeResponse = await fetch('/get_category_data/income');
            const incomeData = await incomeResponse.json();
            let incomeHtml = '';
            
            for (const [category, amount] of Object.entries(incomeData)) {
                if (category === '_total') continue;
                const percentage = (amount / incomeData._total * 100).toFixed(1);
                incomeHtml += `
                    <tr>
                        <td>${category}</td>
                        <td>₱${formatCurrency(amount)}</td>
                        <td>
                            <div class="progress">
                                <div class="progress-bar bg-success" role="progressbar" 
                                    style="width: ${percentage}%" 
                                    aria-valuenow="${percentage}" 
                                    aria-valuemin="0" 
                                    aria-valuemax="100">
                                    ${percentage}%
                                </div>
                            </div>
                        </td>
                    </tr>`;
            }
            document.getElementById('income-categories').innerHTML = incomeHtml || '<tr><td colspan="3" class="text-center">No data available</td></tr>';
            
            // Update expense categories
            const expenseResponse = await fetch('/get_category_data/expense');
            const expenseData = await expenseResponse.json();
            let expenseHtml = '';
            
            for (const [category, amount] of Object.entries(expenseData)) {
                if (category === '_total') continue;
                const percentage = (amount / expenseData._total * 100).toFixed(1);
                expenseHtml += `
                    <tr>
                        <td>${category}</td>
                        <td>₱${formatCurrency(amount)}</td>
                        <td>
                            <div class="progress">
                                <div class="progress-bar bg-danger" role="progressbar" 
                                    style="width: ${percentage}%" 
                                    aria-valuenow="${percentage}" 
                                    aria-valuemin="0" 
                                    aria-valuemax="100">
                                    ${percentage}%
                                </div>
                            </div>
                        </td>
                    </tr>`;
            }
            document.getElementById('expense-categories').innerHTML = expenseHtml || '<tr><td colspan="3" class="text-center">No data available</td></tr>';
        } catch (error) {
            console.error('Error updating category tables:', error);
        }
    };

    // Load budgets
    const loadBudgets = async () => {
        try {
            const response = await fetch('/get_budgets');
            const { budgets } = await response.json();
            const container = document.getElementById('budgets-container');
            
            if (!budgets || !budgets.length) {
                container.innerHTML = '<div class="col-12 text-center">No budgets found for this month</div>';
                return;
            }
            
            let html = '';
            for (const budget of budgets) {
                const percentage = ((budget.spent / budget.amount) * 100).toFixed(1);
                let status = 'success';
                if (percentage >= 90) {
                    status = 'danger';
                } else if (percentage >= 70) {
                    status = 'warning';
                }
                
                html += `
                    <div class="col-md-4 mb-4">
                        <div class="card h-100">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <h5 class="card-title mb-0">${budget.category}</h5>
                                    <button class="btn btn-sm btn-outline-danger" onclick="deleteBudget(${budget.id})">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                                <div class="mb-2">
                                    <small class="text-muted">Spent: ₱${formatCurrency(budget.spent)} of ₱${formatCurrency(budget.amount)}</small>
                                </div>
                                <div class="progress">
                                    <div class="progress-bar bg-${status}" role="progressbar" 
                                        style="width: ${percentage}%" 
                                        aria-valuenow="${percentage}" 
                                        aria-valuemin="0" 
                                        aria-valuemax="100">
                                        ${percentage}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>`;
            }
            
            container.innerHTML = html;
        } catch (error) {
            console.error('Error loading budgets:', error);
        }
    };

    // Initialize everything
    updateSummaryCards();
    updateCategoryTables();
    loadBudgets();

    // Set up auto-refresh every minute (60000ms)
    setInterval(() => {
        updateSummaryCards();
        updateCategoryTables();
        loadBudgets();
    }, 60000);

    // Handle budget form submission
    document.getElementById('budgetForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = {
            category: formData.get('category'),
            amount: parseFloat(formData.get('amount')),
            month: formData.get('month')
        };
        
        try {
            const response = await fetch('/add_dashboard_budget', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                bootstrap.Modal.getInstance(document.getElementById('addBudgetModal')).hide();
                e.target.reset();
                loadBudgets();
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to add budget');
            }
        } catch (error) {
            console.error('Error adding budget:', error);
            alert('Failed to add budget');
        }
    });
});

// Delete budget
async function deleteBudget(id) {
    if (!confirm('Are you sure you want to delete this budget?')) {
        return;
    }
    
    try {
        const response = await fetch(`/delete_dashboard_budget/${id}`, {
            method: 'POST'
        });
        
        if (response.ok) {
            loadBudgets();
        } else {
            const error = await response.json();
            alert(error.error || 'Failed to delete budget');
        }
    } catch (error) {
        console.error('Error deleting budget:', error);
        alert('Failed to delete budget');
    }
}
