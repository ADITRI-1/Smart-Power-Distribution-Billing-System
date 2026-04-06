document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.querySelector('.data-table tbody');
    fetch(`${API_BASE}/consumers`).then(res => res.json()).then(data => {
        tbody.innerHTML = '';
        data.forEach(row => {
            const editBtn = `<span class="action-edit" onclick="editConsumer(${row.consumer_id}, '${row.full_name}', '${row.address}', ${row.age})">✎</span>`;
            tbody.innerHTML += `<tr><td>${row.consumer_id}</td><td>${row.full_name}</td><td>${row.address}</td><td>${row.age}</td><td class="action-icons"><span class="action-view" onclick="viewConsumer(${row.consumer_id})">👁️</span> ${editBtn} ${getDeleteBtn('consumer', row.consumer_id)}</td></tr>`;
        });
    });

    document.querySelector('.btn-add').addEventListener('click', () => {
        document.body.insertAdjacentHTML('beforeend', `<div id="addConsModal" class="modal-overlay" style="display:flex;"><div class="modal-content" style="max-width: 400px;"><div class="modal-header"><h2>Add Consumer</h2><span class="close-btn" onclick="closeModal('addConsModal')">✕</span></div><div class="form-group"><label>Consumer ID</label><input type="number" id="m_cons_id"></div><div class="form-group"><label>Name</label><input type="text" id="m_name"></div><div class="form-group"><label>Address</label><input type="text" id="m_addr"></div><div class="form-group"><label>Age</label><input type="number" id="m_age"></div><button class="btn-primary" id="submitConsBtn">Save</button></div></div>`);
        document.getElementById('submitConsBtn').addEventListener('click', async () => {
            const id = document.getElementById('m_cons_id').value, name = document.getElementById('m_name').value, address = document.getElementById('m_addr').value, age = document.getElementById('m_age').value;
            if(!id || !name || !address || !age) return;
            const res = await fetch(`${API_BASE}/consumers`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, name, address, age})});
            if(res.ok) window.location.reload(); else alert((await res.json()).error);
        });
    });
});

window.editConsumer = async function(id, cN, cA, cAg) {
    const name = prompt("Name:", cN), address = prompt("Address:", cA), age = prompt("Age:", cAg);
    if(name && address && age) {
        const res = await fetch(`${API_BASE}/consumers/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, address, age}) });
        if(res.ok) window.location.reload();
    }
};

window.viewConsumer = async function(consumerId) {
    const data = await (await fetch(`${API_BASE}/consumer/${consumerId}/details`)).json();
    document.getElementById('modalBasicInfo').innerHTML = `<div class="detail-group"><div class="detail-label">Name</div><div class="detail-value">${data.consumer.full_name}</div></div><div class="detail-group"><div class="detail-label">Age</div><div class="detail-value">${data.consumer.age} yrs</div></div>`;
    const tbody = document.querySelector('#modalConnectionsTable tbody');
    tbody.innerHTML = '';
    if(data.connections.length === 0) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No meters linked.</td></tr>';
    else data.connections.forEach(c => { tbody.innerHTML += `<tr><td>${c.connection_id}</td><td>${c.grid_name}</td><td>${c.zone}</td><td>${c.load_assign}</td><td><span class="badge ${c.status==='Active'?'badge-blue':'badge-gray'}">${c.status}</span></td></tr>`; });
    document.getElementById('consumerModal').style.display = 'flex';
};