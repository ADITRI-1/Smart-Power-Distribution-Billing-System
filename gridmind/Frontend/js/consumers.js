document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';
    const tbody = document.querySelector('.data-table tbody');

    // ==========================================
    // 1. FETCH AND DISPLAY ALL CONSUMERS
    // ==========================================
    if (tbody) {
        fetch(`${API_BASE}/consumers`)
            .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
                return res.json();
            })
            .then(data => {
                tbody.innerHTML = '';
                
                // CRITICAL SAFETY CHECK: If Python returns an error instead of an array
                if (!Array.isArray(data)) {
                    console.error("Backend sent invalid data:", data);
                    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Error: Database returned invalid data. Check Python console.</td></tr>`;
                    return;
                }

                if(data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No consumers found.</td></tr>';
                    return;
                }
                
                data.forEach(row => {
                    const editBtn = `<span class="action-edit" onclick="editConsumer(${row.consumer_id}, '${row.full_name}', '${row.address}', ${row.age})">✎</span>`;
                    tbody.innerHTML += `
                        <tr>
                            <td>${row.consumer_id}</td>
                            <td>${row.full_name}</td>
                            <td>${row.address}</td>
                            <td>${row.age}</td>
                            <td class="action-icons">
                                <span class="action-view" onclick="viewConsumer(${row.consumer_id})">👁️</span> 
                                ${editBtn} 
                                ${getDeleteBtn('consumer', row.consumer_id)}
                            </td>
                        </tr>`;
                });
            })
            .catch(err => {
                console.error("Fetch Error:", err);
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Failed to connect to Python Backend. Is Flask running?</td></tr>`;
            });
    }

    // ==========================================
    // 2. ADD CONSUMER (DUAL-INSERT MODAL)
    // ==========================================
    const addBtn = document.querySelector('.btn-add');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const modalHtml = `
                <div id="addConsModal" class="modal-overlay" style="display:flex;">
                    <div class="modal-content" style="max-width: 450px;">
                        <div class="modal-header">
                            <h2>Add New Consumer</h2>
                            <span class="close-btn" onclick="closeModal('addConsModal')">✕</span>
                        </div>
                        
                        <h3 style="margin-bottom: 10px; color: #4B5563; font-size: 14px;">Profile Details</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group"><label>Consumer ID</label><input type="number" id="m_cons_id"></div>
                            <div class="form-group"><label>Age</label><input type="number" id="m_age"></div>
                        </div>
                        <div class="form-group"><label>Full Name</label><input type="text" id="m_name"></div>
                        <div class="form-group"><label>Permanent Address</label><input type="text" id="m_addr"></div>
                        
                        <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid #e5e7eb;">
                        
                        <h3 style="margin-bottom: 10px; color: #4B5563; font-size: 14px;">Portal Login Credentials</h3>
                        <div class="form-group"><label>Username</label><input type="text" id="m_username" placeholder="e.g. jdoe_123"></div>
                        <div class="form-group"><label>Password</label><input type="password" id="m_password" placeholder="Temporary password"></div>
                        
                        <button class="btn-primary" id="submitConsBtn" style="width: 100%; margin-top: 1rem;">Create Consumer & Account</button>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            document.getElementById('submitConsBtn').addEventListener('click', async () => {
                const id = document.getElementById('m_cons_id').value;
                const name = document.getElementById('m_name').value;
                const address = document.getElementById('m_addr').value;
                const age = document.getElementById('m_age').value;
                const username = document.getElementById('m_username').value;
                const password = document.getElementById('m_password').value;

                if(!id || !name || !address || !age || !username || !password) {
                    return alert("Please fill out all profile and login fields!");
                }

                try {
                    const res = await fetch(`${API_BASE}/consumers`, { 
                        method: 'POST', 
                        headers: {'Content-Type': 'application/json'}, 
                        body: JSON.stringify({id, name, address, age, username, password})
                    });
                    
                    if(res.ok) {
                        window.location.reload(); 
                    } else {
                        const errorData = await res.json();
                        alert("Error: " + (errorData.error || "Username or ID might already be taken."));
                    }
                } catch(e) {
                    alert("Server Error. Please check your connection.");
                }
            });
        });
    }
});

// ==========================================
// 3. EDIT CONSUMER (Dynamic Modal)
// ==========================================
window.editConsumer = function(id, currentName, currentAddress, currentAge) {
    const API_BASE = 'http://localhost:5000/api';
    const modalHtml = `
        <div id="editConsModal" class="modal-overlay" style="display:flex;">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h2>Edit Consumer #${id}</h2>
                    <span class="close-btn" onclick="closeModal('editConsModal')">✕</span>
                </div>
                <div class="form-group"><label>Name</label><input type="text" id="e_cons_name" value="${currentName}"></div>
                <div class="form-group"><label>Address</label><input type="text" id="e_cons_addr" value="${currentAddress}"></div>
                <div class="form-group"><label>Age</label><input type="number" id="e_cons_age" value="${currentAge}"></div>
                <button class="btn-primary" id="updateConsBtn">Update Consumer</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('updateConsBtn').addEventListener('click', async () => {
        const name = document.getElementById('e_cons_name').value;
        const address = document.getElementById('e_cons_addr').value;
        const age = document.getElementById('e_cons_age').value;
        if(!name || !address || !age) return alert("Fill all fields");

        try {
            const res = await fetch(`${API_BASE}/consumers/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, address, age}) });
            if(res.ok) window.location.reload(); else alert("Error updating consumer.");
        } catch(e) { alert("Server error"); }
    });
};

// ==========================================
// 4. VIEW CONSUMER (Dynamic Details Modal)
// ==========================================
window.viewConsumer = async function(consumerId) {
    const API_BASE = 'http://localhost:5000/api';
    try {
        const response = await fetch(`${API_BASE}/consumer/${consumerId}/details`);
        const data = await response.json();
        
        // Remove any old modals just in case
        const existingModal = document.getElementById('consumerModal');
        if (existingModal) existingModal.remove();

        const tableRows = data.connections.length === 0 
            ? '<tr><td colspan="5" style="text-align:center;">No meters linked.</td></tr>' 
            : data.connections.map(c => `<tr><td>${c.connection_id}</td><td>${c.grid_name}</td><td>${c.zone}</td><td>${c.load_assign}</td><td><span class="badge ${c.status==='Active'?'badge-blue':'badge-gray'}">${c.status}</span></td></tr>`).join('');

        const modalHtml = `
            <div id="consumerModal" class="modal-overlay" style="display:flex;">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2>Consumer Profile (#${consumerId})</h2>
                        <span class="close-btn" onclick="closeModal('consumerModal')">✕</span>
                    </div>
                    <div style="display:flex; gap:30px; margin-bottom: 20px; background: #f9fafb; padding: 15px; border-radius: 8px;">
                        <div class="detail-group">
                            <div class="detail-label" style="font-size: 12px; color: #6b7280;">Full Name</div>
                            <div class="detail-value" style="font-weight: 600; color: #111827;">${data.consumer.full_name}</div>
                        </div>
                        <div class="detail-group">
                            <div class="detail-label" style="font-size: 12px; color: #6b7280;">Age</div>
                            <div class="detail-value" style="font-weight: 600; color: #111827;">${data.consumer.age} yrs</div>
                        </div>
                    </div>
                    <h3 style="font-size: 16px; margin-bottom: 10px; color: #374151;">Linked Meters</h3>
                    <table class="data-table" style="margin-top: 10px; width: 100%;">
                        <thead>
                            <tr><th>Conn ID</th><th>Grid</th><th>Zone</th><th>Load</th><th>Status</th></tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch(err) {
        alert("Error fetching consumer details.");
    }
};