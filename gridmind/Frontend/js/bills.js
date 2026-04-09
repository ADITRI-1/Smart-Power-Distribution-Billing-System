let allBills = []; 
let currentSort = { column: 'due_date', direction: 'desc' };
const API_BASE = 'http://localhost:5000/api';

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
    
    // Setup filter listeners
    document.getElementById('searchConn').addEventListener('input', renderBills);
    document.getElementById('searchStatus').addEventListener('change', renderBills);
    document.getElementById('searchMonth').addEventListener('change', renderBills);
});

async function fetchBills() {
    try {
        const res = await fetch(`${API_BASE}/bills`);
        allBills = await res.json();
        renderBills();
    } catch(e) {
        console.error("Error fetching bills:", e);
    }
}

function renderBills() {
    const tbody = document.querySelector('#billsTable tbody'); 
    tbody.innerHTML = '';
    
    const filterConn = document.getElementById('searchConn').value.toLowerCase();
    const filterStatus = document.getElementById('searchStatus').value;
    const filterMonth = document.getElementById('searchMonth').value; 
    
    let fData = allBills.filter(b => 
        b.connection_id.toString().includes(filterConn) && 
        (filterStatus === "" || b.status === filterStatus) && 
        (filterMonth === "" || b.month === filterMonth)
    );
    
    fData.sort((a, b) => {
        let vA = ['bill_id', 'connection_id', 'units', 'amount'].includes(currentSort.column) ? parseFloat(a[currentSort.column]) : a[currentSort.column];
        let vB = ['bill_id', 'connection_id', 'units', 'amount'].includes(currentSort.column) ? parseFloat(b[currentSort.column]) : b[currentSort.column];
        if (vA < vB) return currentSort.direction === 'asc' ? -1 : 1;
        if (vA > vB) return currentSort.direction === 'asc' ? 1 : -1; 
        return 0;
    });
    
    if(fData.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No bills found.</td></tr>'; 
        return; 
    }
    
    fData.forEach(row => {
        let badge = row.status === 'Paid' ? 'badge-blue' : (row.status === 'Overdue' ? 'badge-red' : 'badge-gray');
        let action = '';
        
        // Dynamic Button Logic
        if (row.status !== 'Paid') {
            // Green button to open the Payment Method modal
            action = `<button class="pay-btn-table" onclick="openAdminPayModal(${row.bill_id})">Mark Paid</button>`;
        } else {
            // Red button to Undo the payment
            action = `<button class="pay-btn-table" style="background-color: #EF4444;" onclick="revertToUnpaid(${row.bill_id})">Revert to Unpaid</button>`;
        }

        tbody.innerHTML += `
            <tr>
                <td>${row.bill_id}</td>
                <td>${row.connection_id}</td>
                <td>${row.month}</td>
                <td>${row.units}</td>
                <td>₹${parseFloat(row.amount).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                <td><span class="badge ${badge}">${row.status}</span></td>
                <td>${row.due_date}</td>
                <td>${action}</td>
            </tr>`;
    });
}

// ----------------------------------------------------
// NEW ADMIN PAYMENT FUNCTIONS
// ----------------------------------------------------

window.openAdminPayModal = function(billId) {
    // Save the bill ID to the hidden input and show the modal
    document.getElementById('admin_pay_bill_id').value = billId;
    document.getElementById('adminPayModal').style.display = 'flex';
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
            closeModal('adminPayModal');
            fetchBills(); // Refresh the table dynamically
        } else {
            alert(data.error);
        }
    } catch(e) { 
        alert("Server Error."); 
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
            alert("Server Error."); 
        }
    }
};

// Make sure close modal works universally if not defined in common.js
window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
};