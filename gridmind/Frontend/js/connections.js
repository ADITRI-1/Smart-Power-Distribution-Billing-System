document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    // 1. LOAD TABLE DATA
    fetch(`${API_BASE}/connections`)
        .then(res => res.json())
        .then(data => {
            tbody.innerHTML = '';
            data.forEach(row => {
                let badgeClass = row.status === 'Active' ? 'badge-blue' : 'badge-gray';
                
                const editBtn = `<button class="btn-action btn-edit" onclick="editConnection(${row.connection_id}, ${row.consumer_id}, ${row.area_id}, '${row.connection_type}', '${row.load}', '${row.status}')">Edit</button>`;
                const deleteBtn = `<button class="btn-action btn-delete" onclick="deleteRecord('connection', ${row.connection_id})">Delete</button>`;

                tbody.innerHTML += `<tr>
                    <td>${row.connection_id}</td>
                    <td>${row.consumer_id}</td>
                    <td>${row.area_id}</td>
                    <td>${row.connection_type}</td>
                    <td>${row.load}</td>
                    <td>${row.install_date}</td>
                    <td><span class="badge ${badgeClass}">${row.status}</span></td>
                    <td class="action-icons">${editBtn} ${deleteBtn}</td>
                </tr>`;
            });
        })
        .catch(err => console.error("Error fetching connections:", err));

    // 2. ADD NEW CONNECTION MODAL
    const addBtn = document.querySelector('.btn-add');
    if (addBtn) {
        addBtn.addEventListener('click', async () => {
            try {
                const consumers = await (await fetch(`${API_BASE}/consumers`)).json();
                const areas = await (await fetch(`${API_BASE}/areas`)).json();
                
                let consOptions = consumers.map(c => `<option value="${c.consumer_id}" data-addr="${c.address}">${c.full_name} (ID: ${c.consumer_id})</option>`).join('');
                let areaOptions = areas.map(a => `<option value="${a.area_id}">${a.zone}, ${a.city} (Area: ${a.area_id})</option>`).join('');
                const today = new Date().toISOString().split('T')[0];

                const modalHtml = `
                    <div id="addConnModal" class="modal-overlay dynamic-modal" style="display:flex;">
                        <div class="modal-content" style="max-width: 450px;">
                            <div class="modal-header">
                                <h2>Add Connection</h2>
                                <span class="close-btn" onclick="closeModal('addConnModal')">✕</span>
                            </div>
                            <div class="form-group"><label>Connection ID</label><input type="number" id="m_conn_id"></div>
                            <div class="form-group">
                                <label>Consumer</label>
                                <select id="m_cons_id" onchange="document.getElementById('m_address').value = this.options[this.selectedIndex].getAttribute('data-addr') || ''">
                                    <option value="">Select...</option>${consOptions}
                                </select>
                            </div>
                            <div class="form-group"><label>Address</label><input type="text" id="m_address" readonly style="background:#f3f4f6;"></div>
                            <div class="form-group"><label>Area</label><select id="m_area_id"><option value="">Select...</option>${areaOptions}</select></div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label>Type</label>
                                    <select id="m_type" onchange="document.getElementById('m_load').value = this.value === 'Domestic' ? '2kW' : '5kW'">
                                        <option value="Domestic">Domestic</option><option value="Commercial">Commercial</option>
                                    </select>
                                </div>
                                <div class="form-group"><label>Load</label><input type="text" id="m_load" value="2kW" readonly style="background:#f3f4f6;"></div>
                            </div>
                            <button class="btn-primary" id="submitConnBtn">Save (Date: ${today})</button>
                        </div>
                    </div>`;
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                
                document.getElementById('submitConnBtn').addEventListener('click', async () => {
                    const id = document.getElementById('m_conn_id').value;
                    const consumer_id = document.getElementById('m_cons_id').value;
                    const area_id = document.getElementById('m_area_id').value;
                    const address = document.getElementById('m_address').value;
                    const type = document.getElementById('m_type').value;
                    const load = document.getElementById('m_load').value;

                    if(!id || !consumer_id || !area_id) return alert("Please fill all required fields");
                    
                    const res = await fetch(`${API_BASE}/connections`, { 
                        method: 'POST', headers: {'Content-Type': 'application/json'}, 
                        body: JSON.stringify({id, consumer_id, area_id, address, type, load, install_date: today, status: 'Active'})
                    });
                    
                    if(res.ok) window.location.reload(); else alert((await res.json()).error);
                });
            } catch(e) { alert("Failed to load dependency data."); }
        });
    }
});