let allBills = []; 
let currentSort = { column: 'due_date', direction: 'desc' };

document.addEventListener('DOMContentLoaded', () => {
    fetchBills();
    
    // Setup sorting listeners
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-sort');
            currentSort.direction = (currentSort.column === col && currentSort.direction === 'asc') ? 'desc' : 'asc';
            currentSort.column = col;
            renderBills();
        });
    });
    
    // Setup filter listeners (Added Search Bill)
    document.getElementById('searchBill').addEventListener('input', renderBills);
    document.getElementById('searchConn').addEventListener('input', renderBills);
    document.getElementById('searchStatus').addEventListener('change', renderBills);
    document.getElementById('searchMonth').addEventListener('change', renderBills);
});

async function fetchBills() {
    const tbody = document.querySelector('#billsTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Loading bills...</td></tr>';
    
    try {
        // API_BASE is pulling safely from common.js
        const res = await fetch(`${API_BASE}/bills`);
        if (!res.ok) throw new Error("HTTP Error");
        
        const data = await res.json();
        
        // Crash Prevention: Ensure we actually got an array back
        if (!Array.isArray(data)) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">Backend Error: Invalid data format received.</td></tr>';
            return;
        }
        
        allBills = data;
        renderBills();
    } catch(e) {
        console.error("Fetch Error:", e);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">Failed to connect to backend. Is Flask running?</td></tr>';
    }
}

function renderBills() {
    const tbody = document.querySelector('#billsTable tbody'); 
    if (!tbody) return;
    tbody.innerHTML = '';
    
    // Fetch values from all filter bars
    const filterBill = (document.getElementById('searchBill').value || '').toLowerCase();
    const filterConn = (document.getElementById('searchConn').value || '').toLowerCase();
    const filterStatus = document.getElementById('searchStatus').value || '';
    const filterMonth = document.getElementById('searchMonth').value || ''; 
    
    // Crash-proof filtering
    let fData = allBills.filter(b => {
        const billStr = (b.bill_id || '').toString().toLowerCase();
        const connStr = (b.connection_id || '').toString().toLowerCase();
        
        const billMatch = billStr.includes(filterBill);
        const connMatch = connStr.includes(filterConn);
        const statusMatch = filterStatus === "" || b.status === filterStatus;
        const monthMatch = filterMonth === "" || b.month === filterMonth;
        
        // Only return rows that match ALL active filters
        return billMatch && connMatch && statusMatch && monthMatch;
    });
    
    // Crash-proof sorting
    fData.sort((a, b) => {
        let vA = a[currentSort.column] || '';
        let vB = b[currentSort.column] || '';
        
        if (['bill_id', 'connection_id', 'units', 'amount'].includes(currentSort.column)) {
            vA = parseFloat(vA) || 0;
            vB = parseFloat(vB) || 0;
        }
        
        if (vA < vB) return currentSort.direction === 'asc' ? -1 : 1;
        if (vA > vB) return currentSort.direction === 'asc' ? 1 : -1; 
        return 0;
    });
    
    if(fData.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No bills found matching criteria.</td></tr>'; 
        return; 
    }
    
    fData.forEach(row => {
        let badge = row.status === 'Paid' ? 'badge-blue' : (row.status === 'Overdue' ? 'badge-red' : 'badge-gray');
        let action = '';
        
        // Dynamic Button Logic
        if (row.status !== 'Paid') {
            action = `<button class="pay-btn-table" onclick="openAdminPayModal(${row.bill_id})">Mark Paid</button>`;
        } else {
            action = `<button class="pay-btn-table" style="background-color: #EF4444;" onclick="revertToUnpaid(${row.bill_id})">Revert to Unpaid</button>`;
        }
        action += `<button class="pay-btn-table" style="background-color: #4B5563; margin-left: 8px;" onclick="downloadInvoice(${row.bill_id})" title="Download PDF">📥 PDF</button>`;

        // Safe number parsing to prevent NaN errors
        const safeAmount = parseFloat(row.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2});

        tbody.innerHTML += `
            <tr>
                <td>${row.bill_id || 'N/A'}</td>
                <td>${row.connection_id || 'N/A'}</td>
                <td>${row.month || 'N/A'}</td>
                <td>${row.units || 0}</td>
                <td>₹${safeAmount}</td>
                <td><span class="badge ${badge}">${row.status || 'Unknown'}</span></td>
                <td>${row.due_date || 'N/A'}</td>
                <td>${action}</td>
            </tr>`;
    });
}

// ----------------------------------------------------
// ADMIN PAYMENT FUNCTIONS
// ----------------------------------------------------

window.openAdminPayModal = function(billId) {
    document.getElementById('admin_pay_bill_id').value = billId;
    document.getElementById('adminPayModal').style.display = 'flex';
};

window.closeAdminPayModal = function() {
    document.getElementById('adminPayModal').style.display = 'none';
};

window.submitAdminPayment = async function() {
    const billId = document.getElementById('admin_pay_bill_id').value;
    const method = document.getElementById('admin_pay_method').value;
    
    try {
        const res = await fetch(`${API_BASE}/admin/bills/${billId}/status`, { 
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ status: 'Paid', method: method })
        });
        const data = await res.json();
        
        if(res.ok) {
            closeAdminPayModal();
            fetchBills(); // Refresh the table dynamically
        } else {
            alert(data.error);
        }
    } catch(e) { 
        alert("Server Error. Ensure backend is running."); 
    }
};

window.revertToUnpaid = async function(billId) {
    if(confirm(`WARNING: Are you sure you want to mark Bill #${billId} as Unpaid? This will remove all payment records for this bill.`)) {
        try {
            const res = await fetch(`${API_BASE}/admin/bills/${billId}/status`, { 
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ status: 'Unpaid' }) // Method is omitted
            });
            const data = await res.json();
            
            if(res.ok) {
                fetchBills(); // Refresh the table dynamically
            } else {
                alert(data.error);
            }
        } catch(e) { 
            alert("Server Error. Ensure backend is running."); 
        }
    }
};