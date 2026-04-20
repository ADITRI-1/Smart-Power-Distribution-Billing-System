document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    function loadReadings() {
        fetch(`${API_BASE}/readings`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => {
                tbody.innerHTML += `<tr>
                    <td>${row.reading_id}</td><td>${row.connection_id}</td><td>${row.billing_month}</td>
                    <td>${parseFloat(row.previous_reading).toFixed(1)}</td><td>${parseFloat(row.current_reading).toFixed(1)}</td>
                    <td class="text-green">+${row.units_consumed}</td>
                    <td class="action-icons">
                        <button class="btn-action btn-edit" onclick="editReading(${row.reading_id}, ${row.previous_reading}, ${row.current_reading})">Edit</button>
                        <button class="btn-action btn-delete" onclick="deleteReading(${row.reading_id})">Delete</button>
                    </td>
                </tr>`;
            });
        });
    }

    loadReadings();

    const addBtn = document.querySelector('.btn-add');
    if (addBtn) {
        addBtn.addEventListener('click', async () => {
            const conns = await (await fetch(`${API_BASE}/connections`)).json();
            let opts = conns.filter(c => c.status === 'Active').map(c => `<option value="${c.connection_id}">Meter #${c.connection_id}</option>`).join('');
            
            const modalHtml = `
                <div id="addReadingModal" class="modal-overlay dynamic-modal" style="display:flex;">
                    <div class="modal-content" style="max-width: 420px;">
                        <div class="modal-header"><h2>Log Meter Reading</h2><span class="close-btn" onclick="closeModal('addReadingModal')">✕</span></div>
                        <div class="form-group"><label>Meter</label>
                            <select id="m_conn_id" onchange="window.checkContinuity(this.value)">
                                <option value="">Select Meter...</option>${opts}
                            </select>
                        </div>
                        <div class="form-group"><label>Month</label><input type="month" id="m_month"></div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group"><label>Prev Reading</label><input type="number" id="m_prev" readonly style="background:#f3f4f6;"></div>
                            <div class="form-group"><label>Curr Reading</label><input type="number" id="m_curr"></div>
                        </div>
                        <p id="cont-msg" style="font-size: 0.75rem; color: #3b82f6; margin-bottom: 15px; font-weight: 600;"></p>
                        <button class="btn-primary" id="submitReadingBtn" style="width:100%;">Save & Generate Bill</button>
                    </div>
                </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            document.getElementById('submitReadingBtn').addEventListener('click', async () => {
                const payload = {
                    connection_id: document.getElementById('m_conn_id').value,
                    billing_month: document.getElementById('m_month').value,
                    previous_reading: document.getElementById('m_prev').value,
                    current_reading: document.getElementById('m_curr').value
                };
                
                const res = await fetch(`${API_BASE}/readings`, { 
                    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) 
                });
                const data = await res.json();
                if(res.ok) window.location.reload(); 
                else alert("DB Error: " + (data.message || data.error));
            });
        });
    }
});

// GLOBAL HELPER: Fetches continuity data from the backend
window.checkContinuity = async function(id) {
    if(!id) return;
    const API_BASE = 'http://localhost:5000/api';
    try {
        const res = await fetch(`${API_BASE}/connection/${id}/last-reading`);
        const data = await res.json();
        document.getElementById('m_prev').value = data.last_reading;
        document.getElementById('cont-msg').innerText = `Last recorded: ${data.last_month}. Ready for next entry!`;
        document.getElementById('cont-msg').style.color = "#10b981";
    } catch(err) {
        console.error("Continuity fetch failed", err);
    }
};