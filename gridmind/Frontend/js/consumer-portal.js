document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';
    const path = window.location.pathname.toLowerCase();
    
    // Strict Security Check
    const consumerId = localStorage.getItem('consumerId');
    if (!consumerId) {
        alert("Session invalid. Please log in again.");
        window.location.replace('login-consumer.html');
        return;
    }

    // ----------------------------------------------------
    // CONSUMER: DASHBOARD
    // ----------------------------------------------------
    if (path.includes('consumer-dashboard.html')) {
        fetch(`${API_BASE}/consumer/${consumerId}/dashboard`)
            .then(res => res.json())
            .then(data => {
                document.getElementById('stat-meters').innerText = data.total_connections || 0;
                document.getElementById('stat-unpaid').innerText = data.unpaid_bills || 0;
                document.getElementById('stat-due').innerText = `₹${parseFloat(data.total_due || 0).toLocaleString(undefined,{minimumFractionDigits:2})}`;
            });

        fetch(`${API_BASE}/consumer/${consumerId}/bills`)
            .then(res => res.json())
            .then(data => {
                const tbody = document.querySelector('#recentBillsTable tbody'); 
                if(!tbody) return; 
                
                tbody.innerHTML = '';
                const recent = data.slice(0, 3); 
                
                if(recent.length === 0) return tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No recent bills.</td></tr>';
                
                recent.forEach(row => {
                    let badge = row.status === 'Paid' ? 'badge-blue' : (row.status === 'Overdue' ? 'badge-red' : 'badge-gray');
                    let action = row.status !== 'Paid' 
                        ? `<button class="btn-action btn-pay" onclick="openPaymentModal(${row.bill_id}, ${row.amount})">Pay Now</button>` 
                        : `<span style="color:var(--primary-green); font-weight:700; padding: 6px 14px;">✔️ Paid</span>`;
                    
                    action += `<button class="btn-action btn-pdf" style="margin-left: 8px;" onclick="downloadInvoice(${row.bill_id})">CSV Bill</button>`;
                    
                    tbody.innerHTML += `<tr>
                        <td>${row.month}</td><td>${row.connection_id}</td><td>₹${parseFloat(row.amount).toLocaleString()}</td>
                        <td><span class="badge ${badge}">${row.status}</span></td><td>${row.due_date}</td>
                        <td class="action-icons">${action}</td>
                    </tr>`;
                });
            });
    } 
    
    // ----------------------------------------------------
    // CONSUMER: METERS
    // ----------------------------------------------------
    else if (path.includes('consumer-connections.html')) {
        fetch(`${API_BASE}/consumer/${consumerId}/connections`)
            .then(res => res.json())
            .then(data => {
                const tbody = document.querySelector('.data-table tbody'); 
                if(!tbody) return;
                
                tbody.innerHTML = '';
                data.forEach(row => {
                    let badgeClass = row.status === 'Active' ? 'badge-blue' : 'badge-gray';
                    tbody.innerHTML += `<tr>
                        <td>${row.connection_id}</td><td>${row.address}</td><td>${row.connection_type}</td>
                        <td>${row.load}</td><td>${row.install_date}</td><td><span class="badge ${badgeClass}">${row.status}</span></td>
                    </tr>`;
                });
            });
    } 
    
    // ----------------------------------------------------
    // CONSUMER: ALL BILLS
    // ----------------------------------------------------
    else if (path.includes('consumer-bills.html')) {
        fetch(`${API_BASE}/consumer/${consumerId}/bills`)
            .then(res => res.json())
            .then(data => {
                const tbody = document.querySelector('.data-table tbody'); 
                if(!tbody) return;
                
                tbody.innerHTML = '';
                data.forEach(row => {
                    let badge = row.status === 'Paid' ? 'badge-blue' : (row.status === 'Overdue' ? 'badge-red' : 'badge-gray');
                    let action = row.status !== 'Paid' 
                        ? `<button class="btn-action btn-pay" onclick="openPaymentModal(${row.bill_id}, ${row.amount})">Pay Now</button>` 
                        : `<span style="color:var(--primary-green); font-weight:700; padding: 6px 14px;">✔️ Paid</span>`;
                    
                    action += `<button class="btn-action btn-pdf" style="margin-left: 8px;" onclick="downloadInvoice(${row.bill_id})">CSV Bill</button>`;
                    
                    tbody.innerHTML += `<tr>
                        <td>${row.month}</td><td>${row.connection_id}</td><td>₹${parseFloat(row.amount).toLocaleString()}</td>
                        <td><span class="badge ${badge}">${row.status}</span></td><td>${row.due_date}</td>
                        <td class="action-icons">${action}</td>
                    </tr>`;
                });
            });
    }

    // ----------------------------------------------------
    // CONSUMER: PROFILE UPDATE
    // ----------------------------------------------------
    else if (path.includes('consumer-profile.html')) {
        fetch(`${API_BASE}/consumer/${consumerId}/profile`)
            .then(res => res.json())
            .then(data => {
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

            if (password && !window.isValidPassword(password)) {
                return alert("New password must contain at least 8 characters, 1 uppercase letter, 1 number, and 1 symbol.");
            }

            try {
                const res = await fetch(`${API_BASE}/consumer/${consumerId}/profile`, { 
                    method: 'PUT', headers: {'Content-Type': 'application/json'}, 
                    body: JSON.stringify({name, address, age, password}) 
                });
                const result = await res.json();
                alert(result.message || result.error);
                if(res.ok) document.getElementById('p_password').value = '';
            } catch(err) { alert("Server error."); }
        });
    }
});

// =========================================================
// THE FIX: WORKING PAYMENT MODAL FOR CONSUMERS
// =========================================================
window.openPaymentModal = function(billId, amount) {
    let existing = document.getElementById('paymentModal');
    if(existing) existing.remove();

    const modalHtml = `
        <div id="paymentModal" class="modal-overlay dynamic-modal" style="display:flex;">
            <div class="modal-content" style="max-width: 400px; text-align: center;">
                <div class="modal-header">
                    <h2>Complete Your Payment</h2>
                    <span class="close-btn" onclick="closeModal('paymentModal')">✕</span>
                </div>
                <p style="color: #4B5563; margin-bottom: 20px; font-weight: 600;">Paying Bill #${billId} - Amount: ₹${parseFloat(amount).toLocaleString()}</p>
                <div style="background: #F8FAFC; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #E2E8F0;">
                    <p style="font-weight: 700; margin-bottom: 10px; color: #0F172A;">Scan to Pay</p>
                    <div style="width: 150px; height: 150px; background: #E2E8F0; margin: 0 auto; display: flex; align-items: center; justify-content: center; border-radius: 8px;">
                        <span style="font-size: 3rem;">📱</span>
                    </div>
                </div>
                <button class="btn-primary" id="simulateSuccessBtn" onclick="submitConsumerPayment(${billId})" style="width: 100%;">Simulate Payment Success</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.submitConsumerPayment = async function(billId) {
    const btn = document.getElementById('simulateSuccessBtn');
    btn.innerText = "Processing...";
    btn.disabled = true;

    try {
        const API_BASE = 'http://localhost:5000/api';
        const res = await fetch(`${API_BASE}/bills/${billId}/pay`, { method: 'POST' });
        const data = await res.json();
        alert(data.message || data.error);
        if (res.ok) window.location.reload();
    } catch (e) {
        alert("Server error processing payment.");
    } finally {
        if(btn) { btn.innerText = "Simulate Payment Success"; btn.disabled = false; }
        closeModal('paymentModal');
    }
};