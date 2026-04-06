document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const API_BASE = 'http://localhost:5000/api';
    const tbody = document.querySelector('.data-table tbody');
    
    // UI Element generators
    const getDeleteBtn = (table, id) => `<span class="action-delete" onclick="deleteRecord('${table}', ${id})" title="Delete">🗑️</span>`;

    // ----------------------------------------------------
    // ADMIN: GRIDS
    // ----------------------------------------------------
    if (path.includes('power-grids.html') && tbody) {
        tbody.innerHTML = '<tr><td colspan="4">Loading data...</td></tr>';
        fetch(`${API_BASE}/grids`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => {
                const editBtn = `<span class="action-edit" onclick="editGrid(${row.grid_id}, '${row.grid_name}', '${row.location}')" title="Edit">✎</span>`;
                tbody.innerHTML += `<tr><td>${row.grid_id}</td><td>${row.grid_name}</td><td>${row.location}</td><td class="action-icons">${editBtn} ${getDeleteBtn('power_grid', row.grid_id)}</td></tr>`;
            });
        });

        document.querySelector('.btn-add').addEventListener('click', async () => {
            const id = prompt("Enter New Grid ID (Number):"); if(!id) return;
            const name = prompt("Enter Grid Name:"); if(!name) return;
            const loc = prompt("Enter Location:"); if(!loc) return;
            
            try {
                const res = await fetch(`${API_BASE}/grids`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, name, location: loc})});
                const data = await res.json();
                if(res.ok) window.location.reload(); else alert(data.error);
            } catch(e) { alert("Server connectivity error."); }
        });
    }

    // ----------------------------------------------------
    // ADMIN: AREAS
    // ----------------------------------------------------
    else if (path.includes('distribution-areas.html') && tbody) {
        fetch(`${API_BASE}/areas`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => { 
                const editBtn = `<span class="action-edit" onclick="editArea(${row.area_id}, '${row.zone}', '${row.city}', ${row.grid_id}, '${row.poc}')" title="Edit">✎</span>`;
                tbody.innerHTML += `<tr><td>${row.area_id}</td><td>${row.zone}</td><td>${row.city}</td><td>${row.grid_id}</td><td>${row.poc}</td><td class="action-icons">${editBtn} ${getDeleteBtn('distribution_area', row.area_id)}</td></tr>`; 
            });
        });

        document.querySelector('.btn-add').addEventListener('click', async () => {
            const id = prompt("Enter New Area ID:"); if(!id) return;
            const grid_id = prompt("Enter Parent Grid ID:"); if(!grid_id) return;
            const zone = prompt("Enter Zone Name:"); if(!zone) return;
            const city = prompt("Enter City:"); if(!city) return;
            const poc = prompt("Enter POC Name:");
            
            try {
                const res = await fetch(`${API_BASE}/areas`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, grid_id, zone, city, poc})});
                const data = await res.json();
                if(res.ok) window.location.reload(); else alert(data.error);
            } catch(e) { alert("Server connectivity error."); }
        });
    }

    // ----------------------------------------------------
    // ADMIN: CONSUMERS
    // ----------------------------------------------------
    else if (path.includes('consumers.html') && tbody) {
        fetch(`${API_BASE}/consumers`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => {
                const editBtn = `<span class="action-edit" onclick="editConsumer(${row.consumer_id}, '${row.full_name}', '${row.address}', ${row.age})" title="Edit Profile">✎</span>`;
                tbody.innerHTML += `<tr>
                    <td>${row.consumer_id}</td><td>${row.full_name}</td><td>${row.address}</td><td>${row.age}</td>
                    <td class="action-icons">
                        <span class="action-view" onclick="viewConsumer(${row.consumer_id})" style="color: var(--primary-blue);" title="View Linked Meters">👁️</span>
                        ${editBtn} ${getDeleteBtn('consumer', row.consumer_id)}
                    </td>
                </tr>`;
            });
        });

        document.querySelector('.btn-add').addEventListener('click', async () => {
            const id = prompt("Enter Consumer ID:"); if(!id) return;
            const name = prompt("Enter Full Name:"); if(!name) return;
            const addr = prompt("Enter Address:"); if(!addr) return;
            const age = prompt("Enter Age:"); if(!age) return;
            
            try {
                const res = await fetch(`${API_BASE}/consumers`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, name, address: addr, age})});
                const data = await res.json();
                if(res.ok) window.location.reload(); else alert(data.error);
            } catch(e) { alert("Server connectivity error."); }
        });
    }

    // ----------------------------------------------------
    // ADMIN: CONNECTIONS
    // ----------------------------------------------------
    else if (path.includes('connections.html') && tbody) {
        fetch(`${API_BASE}/connections`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => {
                let badgeClass = row.status === 'Active' ? 'badge-blue' : 'badge-gray';
                const editBtn = `<span class="action-edit" onclick="editConnection(${row.connection_id}, ${row.consumer_id}, ${row.area_id}, '${row.connection_type}', '${row.load}', '${row.status}')" title="Edit Connection">✎</span>`;
                tbody.innerHTML += `<tr><td>${row.connection_id}</td><td>${row.consumer_id}</td><td>${row.area_id}</td><td>${row.connection_type}</td><td>${row.load}</td><td>${row.install_date}</td><td><span class="badge ${badgeClass}">${row.status}</span></td><td class="action-icons">${editBtn} ${getDeleteBtn('connection', row.connection_id)}</td></tr>`;
            });
        });

        document.querySelector('.btn-add').addEventListener('click', async () => {
            const id = prompt("Enter Connection ID:"); if(!id) return;
            const consumer_id = prompt("Enter Consumer ID:"); if(!consumer_id) return;
            const area_id = prompt("Enter Area ID:"); if(!area_id) return;
            const address = prompt("Enter Address:"); if(!address) return;
            const type = prompt("Enter Type (Domestic/Commercial):", "Domestic");
            const load = prompt("Enter Load (e.g. 2kW):", "2kW");
            
            const today = new Date().toISOString().split('T')[0];
            try {
                const res = await fetch(`${API_BASE}/connections`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, consumer_id, area_id, address, type, load, install_date: today, status: 'Active'})});
                const data = await res.json();
                if(res.ok) window.location.reload(); else alert(data.error);
            } catch(e) { alert("Server connectivity error."); }
        });
    }

    // ----------------------------------------------------
    // OTHER ROUTES
    // ----------------------------------------------------
    else if (path.includes('meter-readings.html') && tbody) {
        fetch(`${API_BASE}/readings`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => { tbody.innerHTML += `<tr><td>${row.reading_id}</td><td>${row.connection_id}</td><td>${row.billing_month}</td><td>${row.previous_reading}</td><td>${row.current_reading}</td><td class="text-green">${row.units_consumed}</td></tr>`; });
        });
    }
    else if (path.includes('bills.html') && tbody) {
        fetch(`${API_BASE}/bills`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => {
                let badge = row.status === 'Paid' ? 'badge-blue' : (row.status === 'Overdue' ? 'badge-red' : 'badge-gray');
                tbody.innerHTML += `<tr><td>${row.bill_id}</td><td>${row.consumer_id}</td><td>${row.connection_id}</td><td>${row.month}</td><td>${row.units}</td><td>₹${row.amount}</td><td><span class="badge ${badge}">${row.status}</span></td><td>${row.due_date}</td><td></td></tr>`;
            });
        });
    }
    else if (path.includes('analytics.html')) {
        fetch(`${API_BASE}/analytics`).then(res => res.json()).then(data => {
            const topAreasTbody = document.querySelector('#top-areas-table tbody');
            const powerLossTbody = document.querySelector('#power-loss-table tbody');
            topAreasTbody.innerHTML = ''; data.top_areas.forEach(row => topAreasTbody.innerHTML += `<tr><td>${row.zone}</td><td>${row.total_units}</td></tr>`);
            powerLossTbody.innerHTML = ''; data.power_loss.forEach(row => powerLossTbody.innerHTML += `<tr><td>${row.zone}</td><td>${row.city}</td><td>${row.units_supplied}</td><td>${row.units_consumed}</td><td class="text-red">${row.power_loss} units</td></tr>`);
            drawCharts(data.power_loss);
        });
    }

    // ----------------------------------------------------
    // CONSUMER ROUTES 
    // ----------------------------------------------------
    const consumerId = localStorage.getItem('consumerId');
    if (path.includes('consumer-dashboard.html')) {
        fetch(`${API_BASE}/consumer/${consumerId}/dashboard`).then(res => res.json()).then(data => {
            document.getElementById('stat-meters').innerText = data.total_connections;
            document.getElementById('stat-unpaid').innerText = data.unpaid_bills;
            document.getElementById('stat-due').innerText = `₹${data.total_due}`;
        });
    } 
    else if (path.includes('consumer-connections.html') && tbody) {
        fetch(`${API_BASE}/consumer/${consumerId}/connections`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => {
                let badgeClass = row.status === 'Active' ? 'badge-blue' : 'badge-gray';
                tbody.innerHTML += `<tr><td>${row.connection_id}</td><td>${row.address}</td><td>${row.connection_type}</td><td>${row.load}</td><td>${row.install_date}</td><td><span class="badge ${badgeClass}">${row.status}</span></td></tr>`;
            });
        });
    }
    else if (path.includes('consumer-bills.html') && tbody) {
        fetch(`${API_BASE}/consumer/${consumerId}/bills`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => {
                let badge = row.status === 'Paid' ? 'badge-blue' : (row.status === 'Overdue' ? 'badge-red' : 'badge-gray');
                let action = row.status !== 'Paid' ? `<span class="action-pay" onclick="payBill(${row.bill_id})">✔ Pay</span>` : '';
                tbody.innerHTML += `<tr><td>${row.bill_id}</td><td>${row.connection_id}</td><td>${row.month}</td><td>${row.units}</td><td>₹${row.amount}</td><td><span class="badge ${badge}">${row.status}</span></td><td>${row.due_date}</td><td>${action}</td></tr>`;
            });
        });
    }
});

// ----------------------------------------------------
// GLOBAL EDIT / DELETE FUNCTIONS
// ----------------------------------------------------

window.editGrid = async function(id, currentName, currentLoc) {
    const name = prompt("Edit Grid Name:", currentName); if(!name) return;
    const location = prompt("Edit Location:", currentLoc); if(!location) return;
    try {
        const res = await fetch(`http://localhost:5000/api/grids/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, location}) });
        const data = await res.json();
        if(res.ok) window.location.reload(); else alert(data.error);
    } catch(e) { alert("Server error"); }
};

window.editArea = async function(id, currentZone, currentCity, currentGridId, currentPoc) {
    const zone = prompt("Edit Zone:", currentZone); if(!zone) return;
    const city = prompt("Edit City:", currentCity); if(!city) return;
    const grid_id = prompt("Edit Parent Grid ID:", currentGridId); if(!grid_id) return;
    const poc = prompt("Edit POC:", currentPoc);
    try {
        const res = await fetch(`http://localhost:5000/api/areas/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({zone, city, grid_id, poc}) });
        const data = await res.json();
        if(res.ok) window.location.reload(); else alert(data.error);
    } catch(e) { alert("Server error"); }
};

window.editConsumer = async function(id, currentName, currentAddress, currentAge) {
    const name = prompt("Edit Name:", currentName); if(!name) return;
    const address = prompt("Edit Address:", currentAddress); if(!address) return;
    const age = prompt("Edit Age:", currentAge); if(!age) return;
    try {
        const res = await fetch(`http://localhost:5000/api/consumers/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, address, age}) });
        const data = await res.json();
        if(res.ok) window.location.reload(); else alert(data.error);
    } catch(e) { alert("Server error"); }
};

window.editConnection = async function(id, currentConsumerId, currentAreaId, currentType, currentLoad, currentStatus) {
    const consumer_id = prompt("Edit Consumer ID:", currentConsumerId); if(!consumer_id) return;
    const area_id = prompt("Edit Area ID:", currentAreaId); if(!area_id) return;
    const type = prompt("Edit Type:", currentType); if(!type) return;
    const load = prompt("Edit Load (e.g. 5kW):", currentLoad); if(!load) return;
    const status = prompt("Edit Status (Active/Inactive):", currentStatus); if(!status) return;
    try {
        const res = await fetch(`http://localhost:5000/api/connections/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({consumer_id, area_id, type, load, status}) });
        const data = await res.json();
        if(res.ok) window.location.reload(); else alert(data.error);
    } catch(e) { alert("Server error"); }
};

window.deleteRecord = async function(tableName, recordId) {
    if(confirm(`Delete record ID ${recordId} from ${tableName}?`)) {
        try { 
            const res = await fetch(`http://localhost:5000/api/delete/${tableName}/${recordId}`, { method: 'DELETE' }); 
            const data = await res.json();
            if(res.ok) window.location.reload(); 
            else alert(data.error || "Cannot delete: Constraint block."); 
        } catch(e) { alert("Server error."); }
    }
};

window.payBill = async function(billId) {
    if(confirm(`Process payment for Bill #${billId}?`)) {
        try {
            const res = await fetch(`http://localhost:5000/api/bills/${billId}/pay`, { method: 'POST' });
            const data = await res.json();
            alert(data.message || data.error);
            if(res.ok) window.location.reload();
        } catch(e) { alert("Server error."); }
    }
};

window.viewConsumer = async function(consumerId) {
    try {
        const res = await fetch(`http://localhost:5000/api/consumer/${consumerId}/details`);
        const data = await res.json();
        if(res.ok) {
            document.getElementById('modalBasicInfo').innerHTML = `
                <div class="detail-group"><div class="detail-label">Full Name</div><div class="detail-value">${data.consumer.full_name}</div></div>
                <div class="detail-group"><div class="detail-label">Age</div><div class="detail-value">${data.consumer.age} yrs</div></div>
            `;
            const tbody = document.querySelector('#modalConnectionsTable tbody');
            tbody.innerHTML = '';
            if(data.connections.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No meters linked.</td></tr>';
            } else {
                data.connections.forEach(c => {
                    let badgeClass = c.status === 'Active' ? 'badge-blue' : 'badge-gray';
                    tbody.innerHTML += `<tr><td>${c.connection_id}</td><td>${c.grid_name}</td><td>${c.zone}</td><td>${c.load_assign}</td><td><span class="badge ${badgeClass}">${c.status}</span></td></tr>`;
                });
            }
            document.getElementById('consumerModal').style.display = 'flex';
        }
    } catch(e) { alert("Could not fetch consumer details."); }
};

function drawCharts(powerLossData) {
    if (!powerLossData || powerLossData.length === 0) return;
    const zones = powerLossData.map(item => item.zone); const consumedData = powerLossData.map(item => parseFloat(item.units_consumed)); const suppliedData = powerLossData.map(item => parseFloat(item.units_supplied));
    const pieCtx = document.getElementById('consumptionPieChart').getContext('2d');
    new Chart(pieCtx, { type: 'pie', data: { labels: zones, datasets: [{ data: consumedData, backgroundColor: ['#2563EB', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6'], borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } } });
    const barCtx = document.getElementById('supplyBarChart').getContext('2d');
    new Chart(barCtx, { type: 'bar', data: { labels: zones, datasets: [ { label: 'Supplied', data: suppliedData, backgroundColor: '#2563EB', }, { label: 'Consumed', data: consumedData, backgroundColor: '#10B981', } ] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } });
}