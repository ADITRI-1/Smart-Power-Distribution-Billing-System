// js/consumer.js
document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';
    const path = window.location.pathname;
    const tbody = document.querySelector('.data-table tbody');
    
    // Grab the logged-in user's ID
    const consumerId = localStorage.getItem('consumerId');
    if (!consumerId) {
        alert("Session expired. Please log in again.");
        window.location.replace('login-consumer.html');
        return;
    }

    // DASHBOARD
    if (path.includes('consumer-dashboard.html')) {
        fetch(`${API_BASE}/consumer/${consumerId}/dashboard`).then(res => res.json()).then(data => {
            document.getElementById('stat-meters').innerText = data.total_connections;
            document.getElementById('stat-unpaid').innerText = data.unpaid_bills;
            document.getElementById('stat-due').innerText = `₹${data.total_due}`;
        });
    } 
    // CONNECTIONS (METERS)
    else if (path.includes('consumer-connections.html') && tbody) {
        fetch(`${API_BASE}/consumer/${consumerId}/connections`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => {
                let badgeClass = row.status === 'Active' ? 'badge-blue' : 'badge-gray';
                tbody.innerHTML += `<tr><td>${row.connection_id}</td><td>${row.address}</td><td>${row.connection_type}</td><td>${row.load}</td><td>${row.install_date}</td><td><span class="badge ${badgeClass}">${row.status}</span></td></tr>`;
            });
        });
    }
    // BILLS
    else if (path.includes('consumer-bills.html') && tbody) {
        fetch(`${API_BASE}/consumer/${consumerId}/bills`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => {
                let badge = row.status === 'Paid' ? 'badge-blue' : (row.status === 'Overdue' ? 'badge-red' : 'badge-gray');
                let action = row.status !== 'Paid' ? `<span class="action-pay" onclick="payConsumerBill(${row.bill_id})">✔ Pay</span>` : '';
                tbody.innerHTML += `<tr><td>${row.bill_id}</td><td>${row.connection_id}</td><td>${row.month}</td><td>${row.units}</td><td>₹${row.amount}</td><td><span class="badge ${badge}">${row.status}</span></td><td>${row.due_date}</td><td>${action}</td></tr>`;
            });
        });
    }
});

window.payConsumerBill = async function(billId) {
    if(confirm(`Process payment for Bill #${billId}?`)) {
        try {
            const res = await fetch(`http://localhost:5000/api/bills/${billId}/pay`, { method: 'POST' });
            const data = await res.json();
            alert(data.message || data.error);
            if(res.ok) window.location.reload();
        } catch(e) { alert("Server error."); }
    }
};