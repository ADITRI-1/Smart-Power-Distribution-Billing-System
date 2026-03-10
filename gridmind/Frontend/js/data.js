document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const API_BASE = 'http://localhost:5000/api';

    // Helper: Find the table body
    const tbody = document.querySelector('.data-table tbody');
    
    // Helper: Create Delete Button HTML
    const getDeleteBtn = (table, id) => `<span class="action-delete" onclick="deleteRecord('${table}', ${id})">🗑️</span>`;

    // --- POWER GRIDS ---
    if (path.includes('power-grids.html') && tbody) {
        tbody.innerHTML = '<tr><td colspan="4">Loading data from PostgreSQL...</td></tr>';
        fetch(`${API_BASE}/grids`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => {
                tbody.innerHTML += `<tr>
                    <td>${row.grid_id}</td><td>${row.grid_name}</td><td>${row.location}</td>
                    <td class="action-icons"><span class="action-edit">✎</span> ${getDeleteBtn('power_grid', row.grid_id)}</td>
                </tr>`;
            });
        });

        document.querySelector('.btn-add').addEventListener('click', async () => {
            const id = prompt("Enter Grid ID (Number):");
            const name = prompt("Enter Grid Name:");
            const loc = prompt("Enter Location:");
            if(id && name && loc) {
                await fetch(`${API_BASE}/grids`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, name, location: loc})});
                window.location.reload();
            }
        });
    }

    // --- DISTRIBUTION AREAS ---
    else if (path.includes('distribution-areas.html') && tbody) {
        fetch(`${API_BASE}/areas`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => {
                tbody.innerHTML += `<tr>
                    <td>${row.area_id}</td><td>${row.zone}</td><td>${row.city}</td><td>${row.grid_id}</td><td>${row.poc}</td>
                    <td class="action-icons"><span class="action-edit">✎</span> ${getDeleteBtn('distribution_area', row.area_id)}</td>
                </tr>`;
            });
        });
    }

    // --- CONSUMERS ---
    else if (path.includes('consumers.html') && tbody) {
        fetch(`${API_BASE}/consumers`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => {
                tbody.innerHTML += `<tr>
                    <td>${row.consumer_id}</td><td>${row.full_name}</td><td>${row.address}</td><td>${row.age}</td>
                    <td class="action-icons"><span class="action-edit">✎</span> ${getDeleteBtn('consumer', row.consumer_id)}</td>
                </tr>`;
            });
        });

        document.querySelector('.btn-add').addEventListener('click', async () => {
            const id = prompt("Enter Consumer ID (Number):");
            const name = prompt("Enter Full Name:");
            const addr = prompt("Enter Address:");
            const age = prompt("Enter Age:");
            if(id && name && addr && age) {
                await fetch(`${API_BASE}/consumers`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, name, address: addr, age})});
                window.location.reload();
            }
        });
    }

    // --- CONNECTIONS ---
    else if (path.includes('connections.html') && tbody) {
        fetch(`${API_BASE}/connections`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => {
                let badgeClass = row.status === 'Active' ? 'badge-blue' : 'badge-gray';
                tbody.innerHTML += `<tr>
                    <td>${row.connection_id}</td><td>${row.consumer_id}</td><td>${row.area_id}</td>
                    <td>${row.connection_type}</td><td>${row.load}</td><td>${row.install_date}</td>
                    <td><span class="badge ${badgeClass}">${row.status}</span></td>
                    <td class="action-icons"><span class="action-edit">✎</span> ${getDeleteBtn('connection', row.connection_id)}</td>
                </tr>`;
            });
        });
    }

    // --- METER READINGS ---
    else if (path.includes('meter-readings.html') && tbody) {
        fetch(`${API_BASE}/readings`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => {
                tbody.innerHTML += `<tr>
                    <td>${row.reading_id}</td><td>${row.connection_id}</td><td>${row.billing_month}</td>
                    <td>${row.previous_reading}</td><td>${row.current_reading}</td><td class="text-green">${row.units_consumed}</td>
                </tr>`;
            });
        });
    }

    // --- BILLS ---
    else if (path.includes('bills.html') && tbody) {
        fetch(`${API_BASE}/bills`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => {
                let badge = row.status === 'Paid' ? 'badge-blue' : (row.status === 'Overdue' ? 'badge-red' : 'badge-gray');
                let action = row.status !== 'Paid' ? `<span class="action-pay">✔ Pay</span>` : '';
                tbody.innerHTML += `<tr>
                    <td>${row.bill_id}</td><td>${row.consumer_id}</td><td>${row.connection_id}</td>
                    <td>${row.month}</td><td>${row.units}</td><td>₹${row.amount}</td>
                    <td><span class="badge ${badge}">${row.status}</span></td><td>${row.due_date}</td><td>${action}</td>
                </tr>`;
            });
        });
    }

    // --- ANALYTICS & CHARTS ---
    else if (path.includes('analytics.html')) {
        fetch(`${API_BASE}/analytics`).then(res => res.json()).then(data => {
            const topAreasTbody = document.querySelector('#top-areas-table tbody');
            const powerLossTbody = document.querySelector('#power-loss-table tbody');
            
            // 1. Populate Top 5 Areas Table
            topAreasTbody.innerHTML = '';
            data.top_areas.forEach(row => {
                topAreasTbody.innerHTML += `<tr><td>${row.zone}</td><td>${row.total_units}</td></tr>`;
            });

            // 2. Populate Power Loss Table
            powerLossTbody.innerHTML = '';
            data.power_loss.forEach(row => {
                powerLossTbody.innerHTML += `<tr>
                    <td>${row.zone}</td><td>${row.city}</td><td>${row.units_supplied}</td>
                    <td>${row.units_consumed}</td><td class="text-red">${row.power_loss} units</td>
                </tr>`;
            });

            // 3. Draw Chart.js Charts using Data
            drawCharts(data.power_loss);
        });
    }
});

// --- CHART.JS DRAWING FUNCTION ---
function drawCharts(powerLossData) {
    // Extract data arrays for charts
    const zones = powerLossData.map(item => item.zone);
    const consumedData = powerLossData.map(item => parseFloat(item.units_consumed));
    const suppliedData = powerLossData.map(item => parseFloat(item.units_supplied));

    // 1. Area-wise Consumption Pie Chart
    const pieCtx = document.getElementById('consumptionPieChart').getContext('2d');
    new Chart(pieCtx, {
        type: 'pie',
        data: {
            labels: zones,
            datasets: [{
                data: consumedData,
                backgroundColor: ['#2563EB', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } }
        }
    });

    // 2. Supply vs Consumption Bar Chart
    const barCtx = document.getElementById('supplyBarChart').getContext('2d');
    new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: zones,
            datasets: [
                {
                    label: 'Supplied',
                    data: suppliedData,
                    backgroundColor: '#2563EB',
                },
                {
                    label: 'Consumed',
                    data: consumedData,
                    backgroundColor: '#10B981',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// Global Delete Function attached to Window
window.deleteRecord = async function(tableName, recordId) {
    if(confirm(`Are you sure you want to delete this record from ${tableName}?`)) {
        try {
            const res = await fetch(`http://localhost:5000/api/delete/${tableName}/${recordId}`, { method: 'DELETE' });
            const data = await res.json();
            if(res.ok) { window.location.reload(); } 
            else { alert("Cannot delete: " + data.error); } 
        } catch(e) { alert("Server error."); }
    }
};