document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    // 1. Load existing connections
    fetch(`${API_BASE}/connections`).then(res => res.json()).then(data => {
        tbody.innerHTML = '';
        data.forEach(row => {
            let badgeClass = row.status === 'Active' ? 'badge-blue' : 'badge-gray';
            const editBtn = `<span class="action-edit" onclick="editConnection(${row.connection_id}, ${row.consumer_id}, ${row.area_id}, '${row.connection_type}', '${row.load}', '${row.status}')" title="Edit Connection">✎</span>`;
            tbody.innerHTML += `<tr><td>${row.connection_id}</td><td>${row.consumer_id}</td><td>${row.area_id}</td><td>${row.connection_type}</td><td>${row.load}</td><td>${row.install_date}</td><td><span class="badge ${badgeClass}">${row.status}</span></td><td class="action-icons">${editBtn} ${getDeleteBtn('connection', row.connection_id)}</td></tr>`;
        });
    });

    // 2. Add Connection (Dynamic Modal with Auto-fetching)
    document.querySelector('.btn-add').addEventListener('click', async () => {
        try {
            // Fetch Consumers and Areas in parallel
            const [consRes, areasRes] = await Promise.all([
                fetch(`${API_BASE}/consumers`), 
                fetch(`${API_BASE}/areas`)
            ]);
            const consumers = await consRes.json();
            const areas = await areasRes.json();

            // Build Options
            let consOptions = consumers.map(c => `<option value="${c.consumer_id}" data-addr="${c.address}">${c.full_name} (ID: ${c.consumer_id})</option>`).join('');
            let areaOptions = areas.map(a => `<option value="${a.area_id}">${a.zone}, ${a.city} (Area: ${a.area_id})</option>`).join('');
            
            // Get today's date automatically
            const today = new Date().toISOString().split('T')[0];

            const modalHtml = `
                <div id="addConnModal" class="modal-overlay" style="display:flex;">
                    <div class="modal-content" style="max-width: 400px;">
                        <div class="modal-header">
                            <h2>Add Connection</h2>
                            <span class="close-btn" onclick="closeModal('addConnModal')">✕</span>
                        </div>
                        <div class="form-group">
                            <label>Connection ID</label>
                            <input type="number" id="m_conn_id" placeholder="e.g. 6001">
                        </div>
                        <div class="form-group">
                            <label>Select Consumer</label>
                            <select id="m_cons_id" onchange="document.getElementById('m_address').value = this.options[this.selectedIndex].getAttribute('data-addr') || ''">
                                <option value="" data-addr="">Select a Consumer...</option>
                                ${consOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Installation Address (Auto-fetched)</label>
                            <input type="text" id="m_address" readonly style="background: #f3f4f6; color: #6B7280; cursor: not-allowed;">
                        </div>
                        <div class="form-group">
                            <label>Select Distribution Area</label>
                            <select id="m_area_id">
                                <option value="">Select Area...</option>
                                ${areaOptions}
                            </select>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label>Type</label>
                                <select id="m_type" onchange="document.getElementById('m_load').value = this.value === 'Domestic' ? '2kW' : '5kW'">
                                    <option value="Domestic">Domestic</option>
                                    <option value="Commercial">Commercial</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Load (Auto-assigned)</label>
                                <input type="text" id="m_load" value="2kW" readonly style="background: #f3f4f6; color: #6B7280; cursor: not-allowed;">
                            </div>
                        </div>
                        <button class="btn-primary" id="submitConnBtn">Save Connection (Date: ${today})</button>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            document.getElementById('submitConnBtn').addEventListener('click', async () => {
                const id = document.getElementById('m_conn_id').value;
                const consumer_id = document.getElementById('m_cons_id').value;
                const area_id = document.getElementById('m_area_id').value;
                const address = document.getElementById('m_address').value;
                const type = document.getElementById('m_type').value;
                const load = document.getElementById('m_load').value;

                if(!id || !consumer_id || !area_id || !address) return alert("Please fill all required fields!");

                const res = await fetch(`${API_BASE}/connections`, { 
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json'}, 
                    body: JSON.stringify({id, consumer_id, area_id, address, type, load, install_date: today, status: 'Active'})
                });
                const data = await res.json();
                if(res.ok) window.location.reload(); else alert(data.error);
            });
        } catch(e) {
            alert("Failed to load consumers or areas. Ensure server is running.");
        }
    });
});

window.editConnection = async function(id, currentConsumerId, currentAreaId, currentType, currentLoad, currentStatus) {
    const consumer_id = prompt("Edit Consumer ID:", currentConsumerId); if(!consumer_id) return;
    const area_id = prompt("Edit Area ID:", currentAreaId); if(!area_id) return;
    const type = prompt("Edit Type (Domestic/Commercial):", currentType); if(!type) return;
    
    // Enforce the rule during edits as well
    const autoLoad = type.toLowerCase() === 'commercial' ? '5kW' : '2kW';
    const load = prompt(`Edit Load (Suggested: ${autoLoad}):`, autoLoad); if(!load) return;
    
    const status = prompt("Edit Status (Active/Inactive):", currentStatus); if(!status) return;
    
    try {
        const res = await fetch(`${API_BASE}/connections/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({consumer_id, area_id, type, load, status}) });
        if(res.ok) window.location.reload(); else alert("Error updating connection.");
    } catch(e) { alert("Server error"); }
};