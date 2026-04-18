const API_BASE = 'http://localhost:5000/api';

// --- PASSWORD VALIDATOR HELPER ---
window.isValidPassword = function(password) {
    const regex = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    return regex.test(password);
};

// ==========================================
// 1. DYNAMIC PAGE ROUTER & TABLE RENDERER
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.toLowerCase();
    const tbody = document.querySelector('.data-table tbody');

    window.getDeleteBtn = function(table, id) {
        return `<button class="btn-action btn-delete" onclick="deleteRecord('${table}', ${id})">Delete</button>`;
    };

    // ADMIN: GRIDS
    if (path.includes('power-grids.html') && tbody) {
        fetch(`${API_BASE}/grids`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => {
                const editBtn = `<button class="btn-action btn-edit" onclick="editGrid(${row.grid_id}, '${row.grid_name}', '${row.location}')">Edit</button>`;
                tbody.innerHTML += `<tr><td>${row.grid_id}</td><td>${row.grid_name}</td><td>${row.location}</td><td class="action-icons">${editBtn} ${getDeleteBtn('power_grid', row.grid_id)}</td></tr>`;
            });
        });
    }

    // ADMIN: AREAS
    else if (path.includes('distribution-areas.html') && tbody) {
        fetch(`${API_BASE}/areas`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => { 
                const editBtn = `<button class="btn-action btn-edit" onclick="editArea(${row.area_id}, '${row.zone}', '${row.city}', ${row.grid_id}, '${row.poc}')">Edit</button>`;
                tbody.innerHTML += `<tr><td>${row.area_id}</td><td>${row.zone}</td><td>${row.city}</td><td>${row.grid_id}</td><td>${row.poc}</td><td class="action-icons">${editBtn} ${getDeleteBtn('distribution_area', row.area_id)}</td></tr>`; 
            });
        });
    }

    // ADMIN: CONSUMERS
    else if (path.includes('consumers.html') && tbody) {
        fetch(`${API_BASE}/consumers`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => {
                const viewBtn = `<button class="btn-action btn-view" onclick="viewConsumer(${row.consumer_id})">Details</button>`;
                const editBtn = `<button class="btn-action btn-edit" onclick="editConsumer(${row.consumer_id}, '${row.full_name}', '${row.address}', ${row.age})">Edit</button>`;
                tbody.innerHTML += `<tr>
                    <td>${row.consumer_id}</td><td>${row.full_name}</td><td>${row.address}</td><td>${row.age}</td>
                    <td class="action-icons">${viewBtn} ${editBtn} ${getDeleteBtn('consumer', row.consumer_id)}</td>
                </tr>`;
            });
        });

        const addBtn = document.querySelector('.btn-add');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const modalHtml = `
                    <div id="addConsModal" class="modal-overlay dynamic-modal" style="display:flex;">
                        <div class="modal-content" style="max-width: 450px;">
                            <div class="modal-header">
                                <h2>Add New Consumer</h2>
                                <span class="close-btn" onclick="closeModal('addConsModal')">✕</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group"><label>Consumer ID</label><input type="number" id="m_cons_id"></div>
                                <div class="form-group"><label>Age</label><input type="number" id="m_age"></div>
                            </div>
                            <div class="form-group"><label>Full Name</label><input type="text" id="m_name"></div>
                            <div class="form-group"><label>Email Address</label><input type="email" id="consumerEmail" placeholder="e.g. user@example.com"></div>
                            <div class="form-group"><label>Permanent Address</label><input type="text" id="m_addr"></div>
                            <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid #e5e7eb;">
                            <h3 style="margin-bottom: 10px; color: #4B5563; font-size: 14px;">Portal Login Credentials</h3>
                            <div class="form-group"><label>Username</label><input type="text" id="m_username" placeholder="e.g. jdoe_123"></div>
                            <div class="form-group"><label>Password (Min 8 char, 1 Upper, 1 Num, 1 Symbol)</label><input type="password" id="m_password"></div>
                            <button class="btn-primary" id="submitConsBtn" style="width: 100%; margin-top: 1rem;">Create Consumer</button>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', modalHtml);

                document.getElementById('submitConsBtn').addEventListener('click', async () => {
                    const id = document.getElementById('m_cons_id').value;
                    const name = document.getElementById('m_name').value;
                    const email = document.getElementById('consumerEmail').value;
                    const address = document.getElementById('m_addr').value;
                    const age = document.getElementById('m_age').value;
                    const username = document.getElementById('m_username').value;
                    const password = document.getElementById('m_password').value;

                    if(!id || !name || !address || !age || !username || !password) return alert("Fill all fields!");

                    if (!window.isValidPassword(password)) {
                        return alert("Password must contain at least 8 characters, 1 uppercase letter, 1 number, and 1 symbol.");
                    }

                    try {
                        const res = await fetch(`${API_BASE}/consumers`, { 
                            method: 'POST', headers: {'Content-Type': 'application/json'}, 
                            body: JSON.stringify({id, name, email, address, age, username, password})
                        });
                        const data = await res.json();
                        if(res.ok) window.location.reload(); else alert(data.error);
                    } catch(e) { alert("Server Error."); }
                });
            });
        }
    }

    // ADMIN: CONNECTIONS
    else if (path.includes('connections.html') && tbody) {
        fetch(`${API_BASE}/connections`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => {
                let badgeClass = row.status === 'Active' ? 'badge-blue' : 'badge-gray';
                const editBtn = `<button class="btn-action btn-edit" onclick="editConnection(${row.connection_id}, ${row.consumer_id}, ${row.area_id}, '${row.connection_type}', '${row.load}', '${row.status}')">Edit</button>`;
                tbody.innerHTML += `<tr>
                    <td>${row.connection_id}</td><td>${row.consumer_id}</td><td>${row.area_id}</td>
                    <td>${row.connection_type}</td><td>${row.load}</td><td>${row.install_date}</td>
                    <td><span class="badge ${badgeClass}">${row.status}</span></td>
                    <td class="action-icons">${editBtn} ${getDeleteBtn('connection', row.connection_id)}</td>
                </tr>`;
            });
        });
    }

    // ADMIN: READINGS
    else if (path.includes('meter-readings.html') && tbody) {
        fetch(`${API_BASE}/readings`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => { 
                const editBtn = `<button class="btn-action btn-edit" onclick="editReading(${row.reading_id}, ${row.previous_reading}, ${row.current_reading})">Edit</button>`;
                const delBtn = `<button class="btn-action btn-delete" onclick="deleteReading(${row.reading_id})">Delete</button>`;
                tbody.innerHTML += `<tr>
                    <td>${row.reading_id}</td><td>${row.connection_id}</td><td>${row.billing_month}</td>
                    <td>${row.previous_reading}</td><td>${row.current_reading}</td><td class="text-green">+${row.units_consumed}</td>
                    <td class="action-icons">${editBtn} ${delBtn}</td>
                </tr>`; 
            });
        });
    }
});


// =========================================================
// 2. GLOBAL ACTIONS
// =========================================================
window.deleteRecord = async function(tableName, recordId) {
    if(confirm(`Are you sure you want to delete this record?`)) {
        try { 
            const res = await fetch(`${API_BASE}/delete/${tableName}/${recordId}`, { method: 'DELETE' }); 
            const data = await res.json();
            if(res.ok) window.location.reload(); else alert(data.error || "Cannot delete."); 
        } catch(e) { alert("Server error."); }
    }
};

window.deleteReading = async function(readingId) {
    if(confirm(`WARNING: Deleting this reading will ALSO delete the generated Bill. Proceed?`)) {
        try {
            const res = await fetch(`${API_BASE}/readings/${readingId}`, { method: 'DELETE' });
            if(res.ok) window.location.reload(); else alert((await res.json()).error);
        } catch(e) { alert("Server error."); }
    }
};

window.logout = function() {
    localStorage.removeItem('consumerId');
    localStorage.removeItem('adminUsername');
    if (window.location.pathname.toLowerCase().includes('consumer')) window.location.replace("login-consumer.html");
    else window.location.replace("login-admin.html");
};

window.closeModal = function(modalId) {
    if(modalId) {
        const m = document.getElementById(modalId);
        if(m) {
            if(m.classList.contains('dynamic-modal')) m.remove();
            else m.style.display = "none";
        }
    } else {
        document.querySelectorAll('.modal-overlay, .modal').forEach(m => m.style.display = 'none');
    }
};

// =========================================================
// 3. ADMIN EDIT MODALS
// =========================================================
window.editGrid = async function(id, curName, curLoc) {
    const modalHtml = `
        <div id="editGridModal" class="modal-overlay dynamic-modal" style="display:flex;">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header"><h2>Edit Grid #${id}</h2><span class="close-btn" onclick="closeModal('editGridModal')">✕</span></div>
                <div class="form-group"><label>Grid Name</label><input type="text" id="e_grid_name" value="${curName}"></div>
                <div class="form-group"><label>Location</label><input type="text" id="e_grid_loc" value="${curLoc}"></div>
                <button class="btn-primary" id="updateGridBtn">Update Grid</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('updateGridBtn').addEventListener('click', async () => {
        const name = document.getElementById('e_grid_name').value;
        const location = document.getElementById('e_grid_loc').value;
        if(!name || !location) return alert("Fill all fields");
        const res = await fetch(`${API_BASE}/grids/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, location}) });
        if(res.ok) window.location.reload(); else alert("Error updating grid.");
    });
};

window.editArea = async function(id, curZone, curCity, curGrid, curPoc) {
    const modalHtml = `
        <div id="editAreaModal" class="modal-overlay dynamic-modal" style="display:flex;">
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header"><h2>Edit Area #${id}</h2><span class="close-btn" onclick="closeModal('editAreaModal')">✕</span></div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group"><label>Zone</label><input type="text" id="e_area_zone" value="${curZone}"></div>
                    <div class="form-group"><label>City</label><input type="text" id="e_area_city" value="${curCity}"></div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group"><label>Grid ID</label><input type="number" id="e_area_grid" value="${curGrid}"></div>
                    <div class="form-group"><label>POC</label><input type="text" id="e_area_poc" value="${curPoc}"></div>
                </div>
                <button class="btn-primary" id="updateAreaBtn">Update Area</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('updateAreaBtn').addEventListener('click', async () => {
        const zone = document.getElementById('e_area_zone').value; const city = document.getElementById('e_area_city').value;
        const grid_id = document.getElementById('e_area_grid').value; const poc = document.getElementById('e_area_poc').value;
        if(!zone || !city || !grid_id) return alert("Fill all required fields");
        const res = await fetch(`${API_BASE}/areas/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({zone, city, grid_id, poc}) });
        if(res.ok) window.location.reload(); else alert("Error updating area.");
    });
};

window.editConsumer = async function(id, curName, curAddr, curAge) {
    const modalHtml = `
        <div id="editConsModal" class="modal-overlay dynamic-modal" style="display:flex;">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header"><h2>Edit Consumer #${id}</h2><span class="close-btn" onclick="closeModal('editConsModal')">✕</span></div>
                <div class="form-group"><label>Full Name</label><input type="text" id="e_cons_name" value="${curName}"></div>
                <div class="form-group"><label>Address</label><input type="text" id="e_cons_addr" value="${curAddr}"></div>
                <div class="form-group"><label>Age</label><input type="number" id="e_cons_age" value="${curAge}"></div>
                <button class="btn-primary" id="updateConsBtn">Update Consumer</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('updateConsBtn').addEventListener('click', async () => {
        const name = document.getElementById('e_cons_name').value; const address = document.getElementById('e_cons_addr').value; const age = document.getElementById('e_cons_age').value;
        if(!name || !address || !age) return alert("Fill all fields");
        const res = await fetch(`${API_BASE}/consumers/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, address, age}) });
        if(res.ok) window.location.reload(); else alert("Error updating consumer.");
    });
};

window.editConnection = async function(id, curCons, curArea, curType, curLoad, curStatus) {
    const isDom = curType === 'Domestic' ? 'selected' : ''; const isCom = curType === 'Commercial' ? 'selected' : '';
    const isAct = curStatus === 'Active' ? 'selected' : ''; const isInact = curStatus === 'Inactive' ? 'selected' : '';
    const modalHtml = `
        <div id="editConnModal" class="modal-overlay dynamic-modal" style="display:flex;">
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header"><h2>Edit Connection #${id}</h2><span class="close-btn" onclick="closeModal('editConnModal')">✕</span></div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group"><label>Consumer ID</label><input type="number" id="e_conn_cons" value="${curCons}"></div>
                    <div class="form-group"><label>Area ID</label><input type="number" id="e_conn_area" value="${curArea}"></div>
                    <div class="form-group"><label>Type</label><select id="e_conn_type" onchange="document.getElementById('e_conn_load').value = this.value === 'Domestic' ? '2kW' : '5kW'"><option value="Domestic" ${isDom}>Domestic</option><option value="Commercial" ${isCom}>Commercial</option></select></div>
                    <div class="form-group"><label>Load</label><input type="text" id="e_conn_load" value="${curLoad}" readonly style="background:#f3f4f6;"></div>
                    <div class="form-group" style="grid-column: span 2;"><label>Status</label><select id="e_conn_status"><option value="Active" ${isAct}>Active</option><option value="Inactive" ${isInact}>Inactive</option></select></div>
                </div>
                <button class="btn-primary" id="updateConnBtn">Update Connection</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('updateConnBtn').addEventListener('click', async () => {
        const consumer_id = document.getElementById('e_conn_cons').value; const area_id = document.getElementById('e_conn_area').value;
        const type = document.getElementById('e_conn_type').value; const load = document.getElementById('e_conn_load').value; const status = document.getElementById('e_conn_status').value;
        if(!consumer_id || !area_id) return alert("Fill all fields");
        const res = await fetch(`${API_BASE}/connections/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({consumer_id, area_id, type, load, status}) });
        if(res.ok) window.location.reload(); else alert("Error updating connection.");
    });
};

window.editReading = async function(id, curPrev, curCurr) {
    const modalHtml = `
        <div id="editReadingModal" class="modal-overlay dynamic-modal" style="display:flex;">
            <div class="modal-content" style="max-width: 420px;">
                <div class="modal-header"><h2>Edit Reading #${id}</h2><span class="close-btn" onclick="closeModal('editReadingModal')">✕</span></div>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.5rem; line-height: 1.4;">Updating reading values will automatically recalculate and generate a new bill.</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group"><label>Prev Reading</label><input type="number" id="e_prev" value="${curPrev}"></div>
                    <div class="form-group"><label>Curr Reading</label><input type="number" id="e_curr" value="${curCurr}"></div>
                </div>
                <button class="btn-primary" id="updateReadingBtn">Update & Recalculate Bill</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('updateReadingBtn').addEventListener('click', async () => {
        const previous_reading = document.getElementById('e_prev').value; const current_reading = document.getElementById('e_curr').value;
        if(!previous_reading || !current_reading) return alert("Fill all fields");
        const res = await fetch(`${API_BASE}/readings/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({previous_reading, current_reading}) });
        if(res.ok) window.location.reload(); else alert("Error updating reading.");
    });
};

window.viewConsumer = async function(consumerId) {
    try {
        const res = await fetch(`${API_BASE}/consumer/${consumerId}/details`);
        const data = await res.json();
        
        let existingModal = document.getElementById('consumerModal');
        if (existingModal) existingModal.remove();

        const tableRows = data.connections.length === 0 
            ? '<tr><td colspan="5" style="text-align:center;">No meters linked.</td></tr>' 
            : data.connections.map(c => `<tr><td>${c.connection_id}</td><td>${c.grid_name}</td><td>${c.zone}</td><td>${c.load_assign}</td><td><span class="badge ${c.status==='Active'?'badge-blue':'badge-gray'}">${c.status}</span></td></tr>`).join('');

        const modalHtml = `
            <div id="consumerModal" class="modal-overlay dynamic-modal" style="display:flex;">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header"><h2>Consumer Profile (#${consumerId})</h2><span class="close-btn" onclick="closeModal('consumerModal')">✕</span></div>
                    <div style="display:flex; gap:30px; margin-bottom: 20px; background: #f9fafb; padding: 15px; border-radius: 8px;">
                        <div class="detail-group"><div class="detail-label">Full Name</div><div class="detail-value">${data.consumer.full_name}</div></div>
                        <div class="detail-group"><div class="detail-label">Age</div><div class="detail-value">${data.consumer.age} yrs</div></div>
                    </div>
                    <h3 style="font-size: 16px; margin-bottom: 10px; color: #374151;">Linked Meters</h3>
                    <table class="data-table" style="margin-top: 10px; width: 100%;">
                        <thead><tr><th>Conn ID</th><th>Grid</th><th>Zone</th><th>Load</th><th>Status</th></tr></thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch(err) { alert("Error fetching consumer details."); }
};

// =========================================================
// 4. ROBUST CSV BILL GENERATOR (100% Data Preserved)
// =========================================================
window.downloadInvoice = async function(billId) {
    const btn = event.currentTarget || document.activeElement;
    const originalText = btn.innerHTML;
    btn.innerHTML = "Generating...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/bills/${billId}/invoice`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch data");

        // Generate perfect, reliable CSV format
        let csvContent = "SMART POWER - OFFICIAL ELECTRICITY BILL\n\n";
        
        csvContent += "[ BILLING DETAILS ]\n";
        csvContent += `Bill ID,${data.bill_id}\n`;
        csvContent += `Billing Month,${data.billing_month}\n`;
        csvContent += `Generated On,${data.generated_on}\n`;
        csvContent += `Due Date,${data.due_date}\n`;
        csvContent += `Status,${data.payment_status.toUpperCase()}\n`;
        if(data.payment_status === 'Paid') {
            csvContent += `Paid On,${data.paid_on}\n`;
            csvContent += `Payment Method,${data.payment_method || 'Online Transaction'}\n`;
        }
        
        csvContent += "\n[ CONSUMER DETAILS ]\n";
        csvContent += `Consumer ID,${data.consumer_id}\n`;
        csvContent += `Name,${data.consumer_name}\n`;
        csvContent += `Address,"${data.permanent_address}"\n`;
        
        csvContent += "\n[ CONNECTION DETAILS ]\n";
        csvContent += `Meter ID,${data.connection_id}\n`;
        csvContent += `Connection Type,${data.connection_type}\n`;
        csvContent += `Assigned Load,${data.load_assign}\n`;
        csvContent += `Power Source,${data.grid_name}\n`;
        csvContent += `Distribution Zone,${data.zone} - ${data.city}\n`;
        
        csvContent += "\n[ METER READINGS & CHARGES ]\n";
        csvContent += `Previous Reading,${data.previous_reading !== null ? data.previous_reading : '-'}\n`;
        csvContent += `Current Reading,${data.current_reading !== null ? data.current_reading : '-'}\n`;
        csvContent += `Units Consumed,${data.units_consumed} kWh\n`;
        csvContent += `Tariff Rate,Rs. ${data.rate_per_unit} per unit\n`;
        csvContent += `Fixed Charges,Rs. ${data.fixed_charge}\n`;
        csvContent += `TOTAL AMOUNT DUE,Rs. ${data.amount}\n`;

        // Create a downloadable Blob
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `SmartPower_Bill_${billId}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (e) {
        alert("Error generating CSV bill.");
    } finally {
        if(btn) { btn.innerHTML = originalText; btn.disabled = false; }
    }
};