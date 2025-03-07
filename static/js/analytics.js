document.addEventListener('DOMContentLoaded', function() {
    // Chart configurations
    let categoryChart = null;
    let trendChart = null;
    const chartColors = [
        '#4e73df', // Primary
        '#1cc88a', // Success
        '#36b9cc', // Info
        '#f6c23e', // Warning
        '#e74a3b', // Danger
        '#858796', // Secondary
        '#5a5c69', // Dark
        '#f8f9fc'  // Light
    ];

    // Initialize charts
    function initializeCharts() {
        const categoryCtx = document.getElementById('categoryChart').getContext('2d');
        const trendCtx = document.getElementById('trendChart').getContext('2d');

        // Category Chart
        categoryChart = new Chart(categoryCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: chartColors,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${label}: ₱${value.toLocaleString()} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });

        // Trend Chart
        trendChart = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Monthly Amount',
                    data: [],
                    borderColor: '#4e73df',
                    backgroundColor: 'rgba(78, 115, 223, 0.05)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `₱${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₱' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    // Fetch and update chart data
    async function updateCharts(transactionType) {
        try {
            // Update chart titles
            document.querySelectorAll('.transaction-type-text').forEach(el => {
                el.textContent = transactionType === 'expense' ? 'Expenses' : 'Income';
            });

            // Fetch category data
            const categoryResponse = await fetch(`/get_category_data/${transactionType}`);
            const categoryData = await categoryResponse.json();

            // Update category chart
            categoryChart.data.labels = categoryData.categories;
            categoryChart.data.datasets[0].data = categoryData.amounts;
            categoryChart.update();

            // Fetch trend data
            const trendResponse = await fetch(`/get_monthly_data/${transactionType}`);
            const trendData = await trendResponse.json();

            // Update trend chart
            trendChart.data.labels = trendData.months;
            trendChart.data.datasets[0].data = trendData.amounts;
            trendChart.data.datasets[0].borderColor = transactionType === 'expense' ? '#e74a3b' : '#1cc88a';
            trendChart.data.datasets[0].backgroundColor = transactionType === 'expense' 
                ? 'rgba(231, 74, 59, 0.05)' 
                : 'rgba(28, 200, 138, 0.05)';
            trendChart.update();

            // Update category table
            updateCategoryTable(categoryData, transactionType);

        } catch (error) {
            console.error('Error fetching data:', error);
            showError('Failed to fetch analytics data. Please try again.');
        }
    }

    // Update category table
    function updateCategoryTable(data, transactionType) {
        const tableBody = document.getElementById('categoryTable');
        const total = data.amounts.reduce((a, b) => a + b, 0);
        
        let html = '';
        data.categories.forEach((category, index) => {
            const amount = data.amounts[index];
            const percentage = total > 0 ? (amount / total * 100).toFixed(1) : 0;
            const color = transactionType === 'expense' ? '#e74a3b' : '#1cc88a';
            
            html += `
                <tr>
                    <td>${category}</td>
                    <td>₱${amount.toLocaleString()}</td>
                    <td>${percentage}%</td>
                    <td>
                        <div class="progress">
                            <div class="progress-bar" role="progressbar" 
                                 style="width: ${percentage}%; background-color: ${color}"
                                 aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html;
    }

    // Download chart as image
    window.downloadChart = function(chartId) {
        const chart = chartId === 'categoryChart' ? categoryChart : trendChart;
        const link = document.createElement('a');
        link.download = `${chartId}.png`;
        link.href = chart.toBase64Image();
        link.click();
    };

    // Refresh charts
    window.refreshCharts = function() {
        const activeType = document.querySelector('input[name="transactionType"]:checked').value;
        updateCharts(activeType);
    };

    // Show error message
    function showError(message) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger alert-dismissible fade show';
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.querySelector('.content-wrapper').prepend(alert);
    }

    // Initialize
    initializeCharts();
    
    // Set up event listeners
    document.querySelectorAll('input[name="transactionType"]').forEach(radio => {
        radio.addEventListener('change', (e) => updateCharts(e.target.value));
    });

    // Initial load
    updateCharts('expense');
});
