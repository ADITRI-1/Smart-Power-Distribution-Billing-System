let allBills = []; let currentSort = { column: 'due_date', direction: 'desc' };

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
    document.getElementById('searchConn').addEventListener('input', renderBills);
    document.getElementById('searchStatus').addEventListener('change', renderBills);
    document.getElementById('searchMonth').addEventListener('change', renderBills);
});

async function fetchBills() {
    allBills = await (await fetch(`${API_BASE}/bills`)).json();
    renderBills();
}

function renderBills() {
    const tbody = document.querySelector('#billsTable tbody'); tbody.innerHTML = '';
    const filterConn = document.getElementById('searchConn').value.toLowerCase(), filterStatus = document.getElementById('searchStatus').value, filterMonth = document.getElementById('searchMonth').value; 
    let fData = allBills.filter(b => b.connection_id.toString().includes(filterConn) && (filterStatus === "" || b.status === filterStatus) && (filterMonth === "" || b.month === filterMonth));
    fData.sort((a, b) => {
        let vA = ['bill_id', 'connection_id', 'units', 'amount'].includes(currentSort.column) ? parseFloat(a[currentSort.column]) : a[currentSort.column];
        let vB = ['bill_id', 'connection_id', 'units', 'amount'].includes(currentSort.column) ? parseFloat(b[currentSort.column]) : b[currentSort.column];
        if (vA < vB) return currentSort.direction === 'asc' ? -1 : 1;
        if (vA > vB) return currentSort.direction === 'asc' ? 1 : -1; return 0;
    });
    if(fData.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No bills found.</td></tr>'; return; }
    fData.forEach(row => {
        let badge = row.status === 'Paid' ? 'badge-blue' : (row.status === 'Overdue' ? 'badge-red' : 'badge-gray');
        let action = row.status !== 'Paid' 
            ? `<button class="pay-btn-table" onclick="payBill(${row.bill_id})">Mark as Paid</button>` 
            : '';
        tbody.innerHTML += `<tr><td>${row.bill_id}</td><td>${row.connection_id}</td><td>${row.month}</td><td>${row.units}</td><td>₹${parseFloat(row.amount).toLocaleString(undefined,{minimumFractionDigits:2})}</td><td><span class="badge ${badge}">${row.status}</span></td><td>${row.due_date}</td><td>${action}</td></tr>`;
    });
}

window.payBill = async function(billId) {
    if(confirm(`Process payment for Bill #${billId}?`)) {
        const res = await fetch(`${API_BASE}/bills/${billId}/pay`, { method: 'POST' });
        alert((await res.json()).message || "Error");
        if(res.ok) fetchBills(); 
    }
};