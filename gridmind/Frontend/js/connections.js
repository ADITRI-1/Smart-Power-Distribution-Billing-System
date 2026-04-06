document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';
    const tbody = document.querySelector('.data-table tbody');
    
    fetch(`${API_BASE}/connections`).then(res => res.json()).then(data => {
        tbody.innerHTML = '';
        data.forEach(row => {
            const editBtn = `<span class="action-edit" onclick="editConnection(${row.connection_id}, ${row.consumer_id}, ${row.area_id}, '${row.connection_type}', '${row.load}', '${row.status}')">✎</span>`;
            tbody.innerHTML += `<tr><td>${row.connection_id}</td><td>${row.consumer_id}</td><td>${row.area_id}</td><td>${row.connection_type}</td><td>${row.load}</td><td>${row.install_date}</td><td><span class="badge ${row.status==='Active'?'badge-blue':'badge-gray'}">${row.status}</span></td><td class="action-icons">${editBtn} ${getDeleteBtn('connection', row.connection_id)}</td></tr>`;
        });
    });

    document.querySelector('.btn-add').addEventListener('click', async () => {
        const consumers = await (await fetch(`${API_BASE}/consumers`)).json();
        const areas = await (await fetch(`${API_BASE}/areas`)).json();
        let consOptions = consumers.map(c => `<option value="${c.consumer_id}" data-addr="${c.address}">${c.full_name} (ID: ${c.consumer_id})</option>`).join('');
        let areaOptions = areas.map(a => `<option value="${a.area_id}">${a.zone}, ${a.city} (Area: ${a.area_id})</option>`).join('');
        const today = new Date().toISOString().split('T')[0];
        
        document.body.insertAdjacentHTML('beforeend', `<div id="addConnModal" class="modal-overlay" style="display:flex;"><div class="modal-content" style="max-width: 400px;"><div class="modal-header"><h2>Add Connection</h2><span class="close-btn" onclick="closeModal('addConnModal')">✕</span></div><div class="form-group"><label>Connection ID</label><input type="number" id="m_conn_id"></div><div class="form-group"><label>Consumer</label><select id="m_cons_id" onchange="document.getElementById('m_address').value = this.options[this.selectedIndex].getAttribute('data-addr') || ''"><option value="">Select...</option>${consOptions}</select></div><div class="form-group"><label>Address</label><input type="text" id="m_address" readonly style="background:#f3f4f6;"></div><div class="form-group"><label>Area</label><select id="m_area_id"><option value="">Select...</option>${areaOptions}</select></div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;"><div class="form-group"><label>Type</label><select id="m_type" onchange="document.getElementById('m_load').value = this.value === 'Domestic' ? '2kW' : '5kW'"><option value="Domestic">Domestic</option><option value="Commercial">Commercial</option></select></div><div class="form-group"><label>Load</label><input type="text" id="m_load" value="2kW" readonly style="background:#f3f4f6;"></div></div><button class="btn-primary" id="submitConnBtn">Save (Date: ${today})</button></div></div>`);
        
        document.getElementById('submitConnBtn').addEventListener('click', async () => {
            const id = document.getElementById('m_conn_id').value, consumer_id = document.getElementById('m_cons_id').value, area_id = document.getElementById('m_area_id').value, address = document.getElementById('m_address').value, type = document.getElementById('m_type').value, load = document.getElementById('m_load').value;
            if(!id || !consumer_id || !area_id) return;
            const res = await fetch(`${API_BASE}/connections`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, consumer_id, area_id, address, type, load, install_date: today, status: 'Active'})});
            if(res.ok) window.location.reload(); else alert((await res.json()).error);
        });
    });
});

window.editConnection = async function(id, curConsId, curAreaId, curType, curLoad, curStatus) {
    const API_BASE = 'http://localhost:5000/api';
    
    const consumers = await (await fetch(`${API_BASE}/consumers`)).json();
    const areas = await (await fetch(`${API_BASE}/areas`)).json();
    
    let consOptions = consumers.map(c => `<option value="${c.consumer_id}" ${c.consumer_id == curConsId ? 'selected' : ''}>${c.full_name} (ID: ${c.consumer_id})</option>`).join('');
    let areaOptions = areas.map(a => `<option value="${a.area_id}" ${a.area_id == curAreaId ? 'selected' : ''}>${a.zone}, ${a.city} (Area: ${a.area_id})</option>`).join('');

    const isDom = curType === 'Domestic' ? 'selected' : '';
    const isCom = curType === 'Commercial' ? 'selected' : '';
    
    const isAct = curStatus === 'Active' ? 'selected' : '';
    const isInact = curStatus === 'Inactive' ? 'selected' : '';

    const modalHtml = `
        <div id="editConnModal" class="modal-overlay" style="display:flex;">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h2>Edit Connection #${id}</h2>
                    <span class="close-btn" onclick="closeModal('editConnModal')">✕</span>
                </div>
                <div class="form-group">
                    <label>Consumer</label>
                    <select id="e_conn_cons">${consOptions}</select>
                </div>
                <div class="form-group">
                    <label>Distribution Area</label>
                    <select id="e_conn_area">${areaOptions}</select>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label>Type</label>
                        <select id="e_conn_type" onchange="document.getElementById('e_conn_load').value = this.value === 'Domestic' ? '2kW' : '5kW'">
                            <option value="Domestic" ${isDom}>Domestic</option>
                            <option value="Commercial" ${isCom}>Commercial</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Load</label>
                        <input type="text" id="e_conn_load" value="${curLoad}" readonly style="background:#f3f4f6;">
                    </div>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="e_conn_status">
                        <option value="Active" ${isAct}>Active</option>
                        <option value="Inactive" ${isInact}>Inactive</option>
                    </select>
                </div>
                <button class="btn-primary" id="updateConnBtn">Update Connection</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('updateConnBtn').addEventListener('click', async () => {
        const consumer_id = document.getElementById('e_conn_cons').value;
        const area_id = document.getElementById('e_conn_area').value;
        const type = document.getElementById('e_conn_type').value;
        const load = document.getElementById('e_conn_load').value;
        const status = document.getElementById('e_conn_status').value;

        try {
            const res = await fetch(`${API_BASE}/connections/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({consumer_id, area_id, type, load, status}) });
            if(res.ok) window.location.reload(); else alert("Error updating connection.");
        } catch(e) { alert("Server error"); }
    });
};