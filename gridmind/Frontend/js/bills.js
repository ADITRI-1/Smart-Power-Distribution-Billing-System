// We rely on API_BASE from common.js!
let allBills = []; 
let currentSort = { column: 'due_date', direction: 'desc' };

document.addEventListener('DOMContentLoaded', () => {
    fetchBills();
    
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-sort');
            currentSort.direction = (currentSort.column === col && currentSort.direction === 'asc') ? 'desc' : 'asc';
            currentSort.column = col;
            renderBills();
        });
    });
    
    document.getElementById('searchBill')?.addEventListener('input', renderBills);
    document.getElementById('searchConn')?.addEventListener('input', renderBills);
    document.getElementById('searchStatus')?.addEventListener('change', renderBills);
    document.getElementById('searchMonth')?.addEventListener('change', renderBills);
});

async function fetchBills() {
    const tbody = document.querySelector('#billsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Loading bills...</td></tr>';
    
    try {
        const res = await fetch(`${API_BASE}/bills`);
        if (!res.ok) throw new Error("HTTP Error");
        const data = await res.json();
        
        if (!Array.isArray(data)) {
            return tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">Backend Error: Invalid format.</td></tr>';
        }
        allBills = data;
        renderBills();
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">Failed to connect to backend.</td></tr>';
    }
}

function renderBills() {
    const tbody = document.querySelector('#billsTable tbody'); 
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const filterBill = (document.getElementById('searchBill')?.value || '').toLowerCase();
    const filterConn = (document.getElementById('searchConn')?.value || '').toLowerCase();
    const filterStatus = document.getElementById('searchStatus')?.value || '';
    const filterMonth = document.getElementById('searchMonth')?.value || ''; 
    
    let fData = allBills.filter(b => {
        const billStr = (b.bill_id || '').toString().toLowerCase();
        const connStr = (b.connection_id || '').toString().toLowerCase();
        return billStr.includes(filterBill) && connStr.includes(filterConn) && 
               (filterStatus === "" || b.status === filterStatus) && 
               (filterMonth === "" || b.month === filterMonth);
    });
    
    fData.sort((a, b) => {
        let vA = a[currentSort.column] || ''; let vB = b[currentSort.column] || '';
        if (['bill_id', 'connection_id', 'units', 'amount'].includes(currentSort.column)) {
            vA = parseFloat(vA) || 0; vB = parseFloat(vB) || 0;
        }
        if (vA < vB) return currentSort.direction === 'asc' ? -1 : 1;
        if (vA > vB) return currentSort.direction === 'asc' ? 1 : -1; 
        return 0;
    });
    
    if(fData.length === 0) return tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No bills found.</td></tr>'; 
    
    fData.forEach(row => {
        let badge = row.status === 'Paid' ? 'badge-blue' : (row.status === 'Overdue' ? 'badge-red' : 'badge-gray');
        
        // BEAUTIFUL ACTION BUTTONS
        let action = row.status !== 'Paid' 
            ? `<button class="btn-action btn-pay" onclick="openAdminPayModal(${row.bill_id})">Mark Paid</button>` 
            : `<button class="btn-action btn-revert" onclick="revertToUnpaid(${row.bill_id})">Revert</button>`;
        
        action += `<button class="btn-action btn-pdf" style="margin-left: 8px;" onclick="downloadInvoice(${row.bill_id})">CSV Bill</button>`;

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
                <td class="action-icons">${action}</td>
            </tr>`;
    });
}

// Payment Handlers
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
            method: 'PUT', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ status: 'Paid', method: method })
        });
        const data = await res.json();
        if(res.ok) { closeAdminPayModal(); fetchBills(); } 
        else alert(data.error);
    } catch(e) { alert("Server Error."); }
};

window.revertToUnpaid = async function(billId) {
    if(confirm(`WARNING: Mark Bill #${billId} as Unpaid?`)) {
        try {
            const res = await fetch(`${API_BASE}/admin/bills/${billId}/status`, { 
                method: 'PUT', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ status: 'Unpaid' }) 
            });
            if(res.ok) fetchBills(); else alert((await res.json()).error);
        } catch(e) { alert("Server Error."); }
    }
};