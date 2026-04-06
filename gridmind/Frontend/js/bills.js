// js/bills.js
let allBills = []; // Store original data for filtering
let currentSort = { column: 'due_date', direction: 'desc' };

document.addEventListener('DOMContentLoaded', () => {
    fetchBills();

    // Attach Sorting Listeners
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');
            // Toggle direction
            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'asc';
            }
            renderBills();
        });
    });

    // Real-time text search
    document.getElementById('searchConn').addEventListener('input', renderBills);
    document.getElementById('searchStatus').addEventListener('change', renderBills);
    document.getElementById('searchMonth').addEventListener('change', renderBills);
});

async function fetchBills() {
    const API_BASE = 'http://localhost:5000/api';
    try {
        const res = await fetch(`${API_BASE}/bills`);
        allBills = await res.json();
        renderBills();
    } catch (e) {
        console.error("Failed to fetch bills");
    }
}

function renderBills() {
    const tbody = document.querySelector('#billsTable tbody');
    tbody.innerHTML = '';

    // 1. Get Filter Values
    const filterConn = document.getElementById('searchConn').value.toLowerCase();
    const filterStatus = document.getElementById('searchStatus').value;
    const filterMonth = document.getElementById('searchMonth').value; // format YYYY-MM

    // 2. Apply Filters
    let filteredData = allBills.filter(bill => {
        const matchConn = bill.connection_id.toString().includes(filterConn);
        const matchStatus = filterStatus === "" || bill.status === filterStatus;
        const matchMonth = filterMonth === "" || bill.month === filterMonth;
        return matchConn && matchStatus && matchMonth;
    });

    // 3. Apply Sorting
    filteredData.sort((a, b) => {
        let valA = a[currentSort.column];
        let valB = b[currentSort.column];

        // Handle numeric sorting
        if (['bill_id', 'connection_id', 'units', 'amount'].includes(currentSort.column)) {
            valA = parseFloat(valA);
            valB = parseFloat(valB);
        }

        if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // 4. Render Table
    if(filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:gray;">No bills match your search criteria.</td></tr>';
        return;
    }

    filteredData.forEach(row => {
        let badge = row.status === 'Paid' ? 'badge-blue' : (row.status === 'Overdue' ? 'badge-red' : 'badge-gray');
        let action = row.status !== 'Paid' ? `<span class="action-pay" onclick="payBill(${row.bill_id})">✔ Pay</span>` : '';
        
        tbody.innerHTML += `
            <tr>
                <td>${row.bill_id}</td>
                <td>${row.connection_id}</td>
                <td>${row.month}</td>
                <td>${row.units}</td>
                <td>₹${parseFloat(row.amount).toLocaleString()}</td>
                <td><span class="badge ${badge}">${row.status}</span></td>
                <td>${row.due_date}</td>
                <td>${action}</td>
            </tr>
        `;
    });
}

window.payBill = async function(billId) {
    if(confirm(`Process payment for Bill #${billId}?`)) {
        try {
            const res = await fetch(`http://localhost:5000/api/bills/${billId}/pay`, { method: 'POST' });
            const data = await res.json();
            alert(data.message || data.error);
            if(res.ok) fetchBills(); // Reload data silently
        } catch(e) { alert("Server error."); }
    }
};