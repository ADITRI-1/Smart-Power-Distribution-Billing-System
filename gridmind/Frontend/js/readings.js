document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    // Load Official Readings
    async function loadReadings() {
        try {
            const res = await fetch(`${API_BASE}/readings`);
            const data = await res.json();
            tbody.innerHTML = '';
            
            data.forEach(row => {
                const editBtn = `<button class="btn-action btn-edit" onclick="editReading(${row.reading_id}, ${row.previous_reading}, ${row.current_reading})">Edit</button>`;
                const deleteBtn = `<button class="btn-action btn-delete" onclick="deleteReading(${row.reading_id})">Delete</button>`;
                
                tbody.innerHTML += `
                    <tr>
                        <td>${row.reading_id}</td>
                        <td>${row.connection_id}</td>
                        <td>${row.billing_month}</td>
                        <td>${parseFloat(row.previous_reading).toFixed(1)}</td>
                        <td>${parseFloat(row.current_reading).toFixed(1)}</td>
                        <td class="text-green">+${row.units_consumed}</td>
                        <td class="action-icons">${editBtn} ${deleteBtn}</td>
                    </tr>`;
            });
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Failed to load data.</td></tr>';
        }
    }

    loadReadings();

    // ADD READING MODAL
    const addBtn = document.querySelector('.btn-add');
    if (addBtn) {
        addBtn.addEventListener('click', async () => {
            const connections = await (await fetch(`${API_BASE}/connections`)).json();
            let connOpts = connections.filter(c => c.status === 'Active').map(c => `<option value="${c.connection_id}">Meter #${c.connection_id}</option>`).join('');
            
            const modalHtml = `
                <div id="addReadingModal" class="modal-overlay dynamic-modal" style="display:flex;">
                    <div class="modal-content" style="max-width: 400px;">
                        <div class="modal-header"><h2>Log Official Reading</h2><span class="close-btn" onclick="closeModal('addReadingModal')">✕</span></div>
                        <div class="form-group"><label>Meter</label><select id="m_conn_id">${connOpts}</select></div>
                        <div class="form-group"><label>Month</label><input type="month" id="m_month" value="2026-04"></div>
                        <div class="form-group"><label>Current Reading</label><input type="number" id="m_curr"></div>
                        <button class="btn-primary" id="submitReadingBtn">Save & Generate Bill</button>
                    </div>
                </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            document.getElementById('submitReadingBtn').addEventListener('click', async () => {
                const payload = {
                    connection_id: document.getElementById('m_conn_id').value,
                    billing_month: document.getElementById('m_month').value,
                    current_reading: document.getElementById('m_curr').value,
                    previous_reading: 0 // Logic in Trigger handles this
                };
                const res = await fetch(`${API_BASE}/readings`, { 
                    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) 
                });
                if(res.ok) window.location.reload(); else alert("Error saving reading.");
            });
        });
    }
});