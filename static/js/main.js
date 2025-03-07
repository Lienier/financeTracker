function updateSummary() {
    fetch('/get_summary')
        .then(response => response.json())
        .then(data => {
            document.getElementById('total-income').textContent = 
                `₱${data.income.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            document.getElementById('total-expenses').textContent = 
                `₱${data.expenses.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            document.getElementById('balance').textContent = 
                `₱${data.balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        });
}

// Update summary on page load
document.addEventListener('DOMContentLoaded', () => {
    const summaryElements = document.querySelectorAll('#total-income, #total-expenses, #balance');
    if (summaryElements.length > 0) {
        updateSummary();
        // Update summary every 30 seconds
        setInterval(updateSummary, 30000);
    }
});

document.addEventListener('DOMContentLoaded', function() {
    // Sidebar toggle functionality
    const sidebarCollapse = document.getElementById('sidebarCollapse');
    const wrapper = document.querySelector('.wrapper');
    
    if (sidebarCollapse) {
        sidebarCollapse.addEventListener('click', function() {
            document.getElementById('sidebar').classList.toggle('active');
            wrapper.classList.toggle('active');
        });
    }

    // Initialize all dropdowns
    var dropdowns = document.querySelectorAll('.dropdown-toggle');
    dropdowns.forEach(function(dropdown) {
        new bootstrap.Dropdown(dropdown);
    });

    // Initialize all tooltips
    var tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltips.forEach(function(tooltip) {
        new bootstrap.Tooltip(tooltip);
    });

    // Auto-hide alerts after 5 seconds
    var alerts = document.querySelectorAll('.alert');
    alerts.forEach(function(alert) {
        setTimeout(function() {
            var bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }, 5000);
    });

    // Add active class to current nav item based on URL
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });

    // Handle transaction form submission if it exists
    const transactionForm = document.getElementById('transactionForm');
    if (transactionForm) {
        transactionForm.addEventListener('submit', function(e) {
            const amount = document.getElementById('amount');
            if (amount && amount.value <= 0) {
                e.preventDefault();
                alert('Amount must be greater than 0');
            }
        });
    }

    // Format currency inputs
    const currencyInputs = document.querySelectorAll('input[type="number"][step="0.01"]');
    currencyInputs.forEach(input => {
        input.addEventListener('change', function() {
            this.value = parseFloat(this.value).toFixed(2);
        });
    });

    // Handle responsive sidebar behavior
    function handleResponsiveSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth <= 768) {
            sidebar.classList.add('active');
            if (wrapper) wrapper.classList.add('active');
        } else {
            sidebar.classList.remove('active');
            if (wrapper) wrapper.classList.remove('active');
        }
    }

    // Initial check and event listener for window resize
    handleResponsiveSidebar();
    window.addEventListener('resize', handleResponsiveSidebar);
});
