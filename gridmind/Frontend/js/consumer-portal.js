document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';
    const path = window.location.pathname;
    const consumerId = localStorage.getItem('consumerId');
    
    // Security: Kick them out if not logged in
    if (!consumerId) { window.location.replace('login-consumer.html'); return; }

    // --- 1. DASHBOARD ---
    if (path.includes('consumer-dashboard.html')) {
        // Fetch High-Level Stats
        fetch(`${API_BASE}/consumer/${consumerId}/dashboard`).then(res => res.json()).then(data => {
            document.getElementById('stat-meters').innerText = data.total_connections || 0;
            document.getElementById('stat-unpaid').innerText = data.unpaid_bills || 0;
            document.getElementById('stat-due').innerText = `₹${parseFloat(data.total_due || 0).toLocaleString(undefined,{minimumFractionDigits:2})}`;
        });

        // Pull Top 3 Most Recent Bills for the Dashboard UI
        fetch(`${API_BASE}/consumer/${consumerId}/bills`).then(res => res.json()).then(data => {
            const tbody = document.querySelector('#recentBillsTable tbody'); 
            if(!tbody) return; 
            tbody.innerHTML = '';
            const recent = data.slice(0, 3); 
            if(recent.length === 0) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No recent bills.</td></tr>';
            
            recent.forEach(row => {
                let badge = row.status === 'Paid' ? 'badge-blue' : (row.status === 'Overdue' ? 'badge-red' : 'badge-gray');
                let action = row.status !== 'Paid' ? `<span class="action-pay" onclick="payConsumerBill(${row.bill_id})">✔ Pay</span>` : '<span style="color:var(--primary-green);">✔️ Paid</span>';
                tbody.innerHTML += `<tr><td>${row.month}</td><td>${row.connection_id}</td><td>₹${parseFloat(row.amount).toLocaleString(undefined,{minimumFractionDigits:2})}</td><td><span class="badge ${badge}">${row.status}</span></td><td>${row.due_date}</td><td>${action}</td></tr>`;
            });
        });
    } 
    
    // --- 2. SMART METERS ---
    else if (path.includes('consumer-connections.html')) {
        fetch(`${API_BASE}/consumer/${consumerId}/connections`).then(res => res.json()).then(data => {
            const tbody = document.querySelector('.data-table tbody'); 
            if(!tbody) return;
            tbody.innerHTML = '';
            data.forEach(row => {
                let badgeClass = row.status === 'Active' ? 'badge-blue' : 'badge-gray';
                tbody.innerHTML += `<tr><td>${row.connection_id}</td><td>${row.address}</td><td>${row.connection_type}</td><td>${row.load}</td><td>${row.install_date}</td><td><span class="badge ${badgeClass}">${row.status}</span></td></tr>`;
            });
        });
    } 
    
    // --- 3. ALL BILLS ---
    else if (path.includes('consumer-bills.html')) {
        fetch(`${API_BASE}/consumer/${consumerId}/bills`).then(res => res.json()).then(data => {
            const tbody = document.querySelector('.data-table tbody'); 
            if(!tbody) return;
            tbody.innerHTML = '';
            data.forEach(row => {
                let badge = row.status === 'Paid' ? 'badge-blue' : (row.status === 'Overdue' ? 'badge-red' : 'badge-gray');
                let action = row.status !== 'Paid' ? `<span class="action-pay" onclick="payConsumerBill(${row.bill_id})">✔ Pay</span>` : '<span style="color:var(--primary-green);">✔️ Paid</span>';
                tbody.innerHTML += `<tr><td>${row.bill_id}</td><td>${row.connection_id}</td><td>${row.month}</td><td>${row.units}</td><td>₹${parseFloat(row.amount).toLocaleString(undefined,{minimumFractionDigits:2})}</td><td><span class="badge ${badge}">${row.status}</span></td><td>${row.due_date}</td><td>${action}</td></tr>`;
            });
        });
    }

    // --- 4. PROFILE MANAGEMENT ---
    else if (path.includes('consumer-profile.html')) {
        fetch(`${API_BASE}/consumer/${consumerId}/profile`).then(res => res.json()).then(data => {
            if(data) {
                document.getElementById('p_username').value = data.username || '';
                document.getElementById('p_name').value = data.full_name || '';
                document.getElementById('p_address').value = data.permanent_address || '';
                document.getElementById('p_age').value = data.age || '';
            }
        });

        document.getElementById('profileForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('p_name').value;
            const address = document.getElementById('p_address').value;
            const age = document.getElementById('p_age').value;
            const password = document.getElementById('p_password').value;

            try {
                const res = await fetch(`${API_BASE}/consumer/${consumerId}/profile`, { 
                    method: 'PUT', 
                    headers: {'Content-Type': 'application/json'}, 
                    body: JSON.stringify({name, address, age, password}) 
                });
                const result = await res.json();
                alert(result.message || result.error);
                if(res.ok) {
                    document.getElementById('p_password').value = ''; // Wipe password input for safety
                }
            } catch(err) { alert("Server error while updating profile."); }
        });
    }
});

// Global Pay Function
window.payConsumerBill = async function(billId) {
    if(confirm(`Process payment for Bill #${billId}?`)) {
        try {
            const res = await fetch(`http://localhost:5000/api/bills/${billId}/pay`, { method: 'POST' });
            alert((await res.json()).message || "Error processing payment.");
            if(res.ok) window.location.reload();
        } catch(e) { alert("Server error."); }
    }
};