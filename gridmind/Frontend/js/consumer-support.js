document.addEventListener('DOMContentLoaded', () => {
    const consumerId = localStorage.getItem('consumerId');
    const path = window.location.pathname.toLowerCase();

    if (!consumerId) { window.location.replace('login-consumer.html'); return; }

    // FETCH PROFILE DATA (Fixes the "Blank Profile" issue)
    if (path.includes('consumer-profile.html')) {
        fetch(`${API_BASE}/consumer/${consumerId}/profile`)
            .then(res => res.json())
            .then(data => {
                document.getElementById('p_name').value = data.full_name || '';
                document.getElementById('p_address').value = data.permanent_address || '';
                document.getElementById('p_age').value = data.age || '';
                document.getElementById('p_username').value = data.username || '';
            });
    }

    // FETCH DASHBOARD (Strictly filtered by consumerId)
    if (path.includes('consumer-dashboard.html')) {
        fetch(`${API_BASE}/consumer/${consumerId}/dashboard`).then(r => r.json()).then(data => {
            document.getElementById('stat-meters').innerText = data.total_connections;
            document.getElementById('stat-unpaid').innerText = data.unpaid_bills;
            document.getElementById('stat-due').innerText = `₹${parseFloat(data.total_due).toLocaleString()}`;
        });

        fetch(`${API_BASE}/consumer/${consumerId}/bills`).then(r => r.json()).then(data => {
            const tbody = document.querySelector('#recentBillsTable tbody');
            tbody.innerHTML = data.length ? '' : '<tr><td colspan="6">No bills found.</td></tr>';
            data.slice(0, 3).forEach(row => {
                let badge = row.status === 'Paid' ? 'badge-green' : 'badge-gray';
                tbody.innerHTML += `<tr><td>${row.month}</td><td>${row.connection_id}</td><td>₹${row.amount}</td><td><span class="badge ${badge}">${row.status}</span></td><td>${row.due_date}</td><td><button class="btn-action btn-pay" onclick="openPaymentModal(${row.bill_id}, ${row.amount})">Pay Now</button></td></tr>`;
            });
        });
    }
});