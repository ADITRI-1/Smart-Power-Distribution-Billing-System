document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';
    const consumerId = localStorage.getItem('consumerId');
    const path = window.location.pathname.toLowerCase();

    // 1. Session Security Check
    if (!consumerId) {
        window.location.replace('login-consumer.html');
        return;
    }

    // ----------------------------------------------------
    // DASHBOARD LOGIC
    // ----------------------------------------------------
    if (path.includes('consumer-dashboard.html')) {
        // Load Stat Cards
        fetch(`${API_BASE}/consumer/${consumerId}/dashboard`)
            .then(res => res.json())
            .then(data => {
                document.getElementById('stat-meters').innerText = data.total_connections || 0;
                document.getElementById('stat-unpaid').innerText = data.unpaid_bills || 0;
                document.getElementById('stat-due').innerText = `₹${parseFloat(data.total_due || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
            });

        // Load Recent Bills (Table)
        fetch(`${API_BASE}/consumer/${consumerId}/bills`)
            .then(res => res.json())
            .then(data => {
                const tbody = document.querySelector('#recentBillsTable tbody');
                if (!tbody) return;
                tbody.innerHTML = '';
                
                const recent = data.slice(0, 3);
                if (recent.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No bills found for your account.</td></tr>';
                    return;
                }

                recent.forEach(row => {
                    let badge = row.status === 'Paid' ? 'badge-green' : (row.status === 'Overdue' ? 'badge-red' : 'badge-gray');
                    let action = row.status !== 'Paid'
                        ? `<button class="btn-action btn-pay" onclick="openPaymentModal(${row.bill_id}, ${row.amount})">Pay Now</button>`
                        : `<span style="color:#10B981; font-weight:700; font-size:0.75rem;">COMPLETED</span>`;

                    action += `<button class="btn-action btn-pdf" style="margin-left: 8px;" onclick="downloadInvoice(${row.bill_id})">CSV</button>`;

                    tbody.innerHTML += `<tr>
                        <td>${row.month}</td>
                        <td>${row.connection_id}</td>
                        <td>₹${parseFloat(row.amount).toLocaleString()}</td>
                        <td><span class="badge ${badge}">${row.status}</span></td>
                        <td>${row.due_date}</td>
                        <td class="action-icons">${action}</td>
                    </tr>`;
                });
            });
    }

    // ----------------------------------------------------
    // MY SMART METERS LOGIC
    // ----------------------------------------------------
    else if (path.includes('consumer-connections.html')) {
        fetch(`${API_BASE}/consumer/${consumerId}/connections`)
            .then(res => res.json())
            .then(data => {
                const tbody = document.querySelector('.data-table tbody');
                if (!tbody) return;
                tbody.innerHTML = '';
                
                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">You have no active meter connections.</td></tr>';
                    return;
                }

                data.forEach(row => {
                    let badgeClass = row.status === 'Active' ? 'badge-blue' : 'badge-gray';
                    tbody.innerHTML += `<tr>
                        <td>${row.connection_id}</td>
                        <td>${row.address}</td>
                        <td>${row.connection_type}</td>
                        <td>${row.load}</td>
                        <td>${row.install_date}</td>
                        <td><span class="badge ${badgeClass}">${row.status}</span></td>
                    </tr>`;
                });
            });
    }

    // ----------------------------------------------------
    // ALL BILLS LOGIC
    // ----------------------------------------------------
    else if (path.includes('consumer-bills.html')) {
        fetch(`${API_BASE}/consumer/${consumerId}/bills`)
            .then(res => res.json())
            .then(data => {
                const tbody = document.querySelector('.data-table tbody');
                if (!tbody) return;
                tbody.innerHTML = '';
                
                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No billing history found.</td></tr>';
                    return;
                }

                data.forEach(row => {
                    let badge = row.status === 'Paid' ? 'badge-green' : (row.status === 'Overdue' ? 'badge-red' : 'badge-gray');
                    let action = row.status !== 'Paid'
                        ? `<button class="btn-action btn-pay" onclick="openPaymentModal(${row.bill_id}, ${row.amount})">Pay Now</button>`
                        : `<span style="color:#10B981; font-weight:700;">✔️ PAID</span>`;

                    action += `<button class="btn-action btn-pdf" style="margin-left: 8px;" onclick="downloadInvoice(${row.bill_id})">CSV</button>`;

                    tbody.innerHTML += `<tr>
                        <td>${row.month}</td>
                        <td>${row.connection_id}</td>
                        <td>₹${parseFloat(row.amount).toLocaleString()}</td>
                        <td><span class="badge ${badge}">${row.status}</span></td>
                        <td>${row.due_date}</td>
                        <td class="action-icons">${action}</td>
                    </tr>`;
                });
            });
    }

    // ----------------------------------------------------
    // PROFILE LOGIC (FIXED FETCHING)
    // ----------------------------------------------------
    else if (path.includes('consumer-profile.html')) {
        fetch(`${API_BASE}/consumer/${consumerId}/profile`)
            .then(res => {
                if (!res.ok) throw new Error("Could not fetch profile");
                return res.json();
            })
            .then(data => {
                // Mapping DB fields to HTML input IDs
                if (data) {
                    if (document.getElementById('p_username')) document.getElementById('p_username').value = data.username || '';
                    if (document.getElementById('p_name')) document.getElementById('p_name').value = data.full_name || '';
                    if (document.getElementById('p_address')) document.getElementById('p_address').value = data.permanent_address || '';
                    if (document.getElementById('p_age')) document.getElementById('p_age').value = data.age || '';
                }
            })
            .catch(err => alert("Error: Failed to load profile details."));

        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const password = document.getElementById('p_password').value;

                // Validate password ONLY if user is trying to change it
                if (password && !window.isValidPassword(password)) {
                    return alert("New password must have 8+ chars, 1 uppercase, 1 number, and 1 symbol.");
                }

                try {
                    const res = await fetch(`${API_BASE}/consumer/${consumerId}/profile`, {
                        method: 'PUT', 
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: document.getElementById('p_name').value,
                            address: document.getElementById('p_address').value,
                            age: document.getElementById('p_age').value,
                            password: password || null
                        })
                    });
                    const result = await res.json();
                    alert(result.message || result.error);
                    if (res.ok) window.location.reload();
                } catch (err) { alert("Server connectivity error."); }
            });
        }
    }
});

// GLOBAL PAYMENT FUNCTIONS
window.openPaymentModal = function (billId, amount) {
    const details = document.getElementById('paymentDetails');
    if (details) details.innerText = `Paying Bill #${billId} - Amount: ₹${parseFloat(amount).toLocaleString()}`;
    document.getElementById('paymentModal').style.display = "flex";
    document.getElementById('simulateSuccessBtn').onclick = () => submitConsumerPayment(billId);
};

async function submitConsumerPayment(billId) {
    const btn = document.getElementById('simulateSuccessBtn');
    btn.innerText = "Processing...";
    btn.disabled = true;
    try {
        const res = await fetch(`http://localhost:5000/api/bills/${billId}/pay`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            alert("Payment Successful!");
            window.location.reload();
        } else alert(data.error || "Payment failed.");
    } catch (e) { alert("Connectivity error."); }
    finally {
        btn.innerText = "Confirm Payment";
        btn.disabled = false;
        closeModal('paymentModal');
    }
}