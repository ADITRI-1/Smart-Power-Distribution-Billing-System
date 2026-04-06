document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    // 1. Load existing consumers
    fetch(`${API_BASE}/consumers`).then(res => res.json()).then(data => {
        tbody.innerHTML = '';
        data.forEach(row => {
            const editBtn = `<span class="action-edit" onclick="editConsumer(${row.consumer_id}, '${row.full_name}', '${row.address}', ${row.age})" title="Edit Profile">✎</span>`;
            tbody.innerHTML += `<tr>
                <td>${row.consumer_id}</td><td>${row.full_name}</td><td>${row.address}</td><td>${row.age}</td>
                <td class="action-icons">
                    <span class="action-view" onclick="viewConsumer(${row.consumer_id})" style="color: var(--primary-blue);" title="View Linked Meters">👁️</span>
                    ${editBtn} ${getDeleteBtn('consumer', row.consumer_id)}
                </td>
            </tr>`;
        });
    });

    // 2. Add Consumer Modal
    document.querySelector('.btn-add').addEventListener('click', () => {
        const modalHtml = `
            <div id="addConsModal" class="modal-overlay" style="display:flex;">
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <h2>Add Consumer</h2>
                        <span class="close-btn" onclick="closeModal('addConsModal')">✕</span>
                    </div>
                    <div class="form-group">
                        <label>Consumer ID</label>
                        <input type="number" id="m_cons_id" placeholder="e.g. 1005">
                    </div>
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" id="m_name" placeholder="e.g. Rahul Sharma">
                    </div>
                    <div class="form-group">
                        <label>Address</label>
                        <input type="text" id="m_addr" placeholder="e.g. MG Road, Pune">
                    </div>
                    <div class="form-group">
                        <label>Age</label>
                        <input type="number" id="m_age" placeholder="e.g. 30">
                    </div>
                    <button class="btn-primary" id="submitConsBtn">Save Consumer</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('submitConsBtn').addEventListener('click', async () => {
            const id = document.getElementById('m_cons_id').value;
            const name = document.getElementById('m_name').value;
            const address = document.getElementById('m_addr').value;
            const age = document.getElementById('m_age').value;
            if(!id || !name || !address || !age) return alert("Please fill all fields");
            
            try {
                const res = await fetch(`${API_BASE}/consumers`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, name, address, age})});
                const data = await res.json();
                if(res.ok) window.location.reload(); else alert(data.error || data.message);
            } catch(e) { alert("Server connectivity error."); }
        });
    });
});

window.editConsumer = async function(id, currentName, currentAddress, currentAge) {
    const name = prompt("Edit Name:", currentName); if(!name) return;
    const address = prompt("Edit Address:", currentAddress); if(!address) return;
    const age = prompt("Edit Age:", currentAge); if(!age) return;
    try {
        const res = await fetch(`http://localhost:5000/api/consumers/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, address, age}) });
        if(res.ok) window.location.reload(); else alert("Error updating consumer.");
    } catch(e) { alert("Server error"); }
};

window.viewConsumer = async function(consumerId) {
    try {
        const res = await fetch(`http://localhost:5000/api/consumer/${consumerId}/details`);
        const data = await res.json();
        if(res.ok) {
            document.getElementById('modalBasicInfo').innerHTML = `
                <div class="detail-group"><div class="detail-label">Full Name</div><div class="detail-value">${data.consumer.full_name}</div></div>
                <div class="detail-group"><div class="detail-label">Age</div><div class="detail-value">${data.consumer.age} yrs</div></div>
            `;
            const tbody = document.querySelector('#modalConnectionsTable tbody');
            tbody.innerHTML = '';
            if(data.connections.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No meters linked.</td></tr>';
            } else {
                data.connections.forEach(c => {
                    let badgeClass = c.status === 'Active' ? 'badge-blue' : 'badge-gray';
                    tbody.innerHTML += `<tr><td>${c.connection_id}</td><td>${c.grid_name}</td><td>${c.zone}</td><td>${c.load_assign}</td><td><span class="badge ${badgeClass}">${c.status}</span></td></tr>`;
                });
            }
            document.getElementById('consumerModal').style.display = 'flex';
        }
    } catch(e) { alert("Could not fetch consumer details."); }
};