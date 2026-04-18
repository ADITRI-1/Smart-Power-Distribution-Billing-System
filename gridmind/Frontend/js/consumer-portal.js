document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';
    const path = window.location.pathname.toLowerCase();
    
    // Strict Security Check: Must have a verified Consumer ID
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
                
                if(recent.length === 0) {
                    return tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No recent bills.</td></tr>';
                }
                
                recent.forEach(row => {
                    let badge = row.status === 'Paid' ? 'badge-blue' : (row.status === 'Overdue' ? 'badge-red' : 'badge-gray');
                    
                    // Aesthetic Pay & PDF Buttons
                    let action = row.status !== 'Paid' 
                        ? `<button class="btn-action btn-pay" onclick="openPaymentModal(${row.bill_id}, ${row.amount})">Pay Now</button>` 
                        : `<span style="color:var(--primary-green); font-weight:700; padding: 6px 14px;">✔️ Paid</span>`;
                    
                    action += `<button class="btn-action btn-pdf" style="margin-left: 8px;" onclick="downloadInvoice(${row.bill_id})">PDF</button>`;
                    
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
                    
                    action += `<button class="btn-action btn-pdf" style="margin-left: 8px;" onclick="downloadInvoice(${row.bill_id})">PDF</button>`;
                    
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

            // Strict Frontend Validation
            if (password && !window.isValidPassword(password)) {
                return alert("New password must contain at least 8 characters, 1 uppercase letter, 1 number, and 1 symbol.");
            }

            try {
                const res = await fetch(`${API_BASE}/consumer/${consumerId}/profile`, { 
                    method: 'PUT', 
                    headers: {'Content-Type': 'application/json'}, 
                    body: JSON.stringify({name, address, age, password}) 
                });
                const result = await res.json();
                
                alert(result.message || result.error);
                
                // Clear password field on success to prevent accidental resubmission
                if(res.ok) document.getElementById('p_password').value = '';
                
            } catch(err) { 
                alert("Server error while updating profile."); 
            }
        });
    }
});