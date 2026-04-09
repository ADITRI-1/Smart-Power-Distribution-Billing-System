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
                let action = row.status !== 'Paid' 
                    ? `<button class="pay-btn-table" onclick="openPaymentModal(${row.bill_id}, ${row.amount})">Pay Now</button>` 
                    : '';
                action += ` <button class="pay-btn-table" style="background-color: #4B5563; margin-left: 15px;" onclick="downloadInvoice(${row.bill_id})" title="Download PDF">📥 PDF</button>`;
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
                
                // Build the actions
                let action = row.status !== 'Paid' 
                    ? `<button class="pay-btn-table" onclick="openPaymentModal(${row.bill_id}, ${row.amount})">Pay Now</button>` 
                    : '<span style="color:var(--primary-green);">✔️ Paid</span>';
                
                // The PDF button
                action += ` <button class="pay-btn-table" style="background-color: #4B5563; margin-left: 15px;" onclick="downloadInvoice(${row.bill_id})" title="Download PDF">📥 PDF</button>`;

                tbody.innerHTML += `<tr><td>${row.month}</td><td>${row.connection_id}</td><td>₹${parseFloat(row.amount).toLocaleString(undefined,{minimumFractionDigits:2})}</td><td><span class="badge ${badge}">${row.status}</span></td><td>${row.due_date}</td><td>${action}</td></tr>`;
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

    // Attach the Success listener only if the button exists on this page
    const simulateBtn = document.getElementById('simulateSuccessBtn');
    if (simulateBtn) {
        simulateBtn.addEventListener('click', function() {
            if (!currentPayingBillId || paymentInProgress) return;
            
            const btn = this;
            paymentInProgress = true;
            btn.innerText = "Processing...";
            btn.disabled = true;
            
            fetch(`${API_BASE}/bills/${currentPayingBillId}/pay`, {
                method: 'POST' 
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert("Payment Successful! Bill marked as Paid.");
                    closePaymentModal();
                    location.reload(); 
                } else {
                    alert("Payment failed: " + (data.error || "Unknown error"));
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert("Network error connecting to backend.");
            })
            .finally(() => {
                paymentInProgress = false;
                btn.innerText = "Simulate Payment Success";
                btn.disabled = false;
            });
        });
    }
});


let currentPayingBillId = null;
let paymentInProgress = false;
let countdownInterval = null;

// Opens the modal and starts the countdown
window.openPaymentModal = function(billId, amount) {
    currentPayingBillId = billId;
    document.getElementById('paymentDetails').innerText = `Paying Bill #${billId} - Amount: ₹${amount}`;
    document.getElementById('paymentModal').style.display = "block";
    startCountdown();
};

// Closes the modal and stops the timer
window.closePaymentModal = function() {
    document.getElementById('paymentModal').style.display = "none";
    currentPayingBillId = null;
    clearInterval(countdownInterval);
};

function startCountdown() {
    clearInterval(countdownInterval); // Clear any old timers
    let timeLeft = 5 * 60; // 5 minutes
    document.getElementById('countdown').innerText = "05:00";
    
    countdownInterval = setInterval(() => {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        document.getElementById('countdown').innerText = 
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
            alert("Payment window expired. Please try again.");
            closePaymentModal();
        }
    }, 1000);
}

