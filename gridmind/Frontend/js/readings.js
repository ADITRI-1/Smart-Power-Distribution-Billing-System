document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.querySelector('.data-table tbody');
    fetch(`${API_BASE}/readings`).then(res => res.json()).then(data => {
        tbody.innerHTML = '';
        data.forEach(row => { tbody.innerHTML += `<tr><td>${row.reading_id}</td><td>${row.connection_id}</td><td>${row.billing_month}</td><td>${row.previous_reading}</td><td>${row.current_reading}</td><td class="text-green">+${row.units_consumed}</td></tr>`; });
    });

    document.querySelector('.btn-add').addEventListener('click', async () => {
        const connections = await (await fetch(`${API_BASE}/connections`)).json();
        let connOptions = connections.filter(c => c.status === 'Active').map(c => `<option value="${c.connection_id}">Conn #${c.connection_id}</option>`).join('');
        document.body.insertAdjacentHTML('beforeend', `<div id="addReadingModal" class="modal-overlay" style="display:flex;"><div class="modal-content" style="max-width: 400px;"><div class="modal-header"><h2>Log Meter Reading</h2><span class="close-btn" onclick="closeModal('addReadingModal')">✕</span></div><div class="form-group"><label>Connection ID</label><select id="m_conn_id"><option value="">Select...</option>${connOptions}</select></div><div class="form-group"><label>Month</label><input type="month" id="m_month"></div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;"><div class="form-group"><label>Prev Reading</label><input type="number" id="m_prev" placeholder="0"></div><div class="form-group"><label>Curr Reading</label><input type="number" id="m_curr" placeholder="0"></div></div><button class="btn-primary" id="submitReadingBtn">Submit</button></div></div>`);
        
        document.getElementById('submitReadingBtn').addEventListener('click', async () => {
            const connection_id = document.getElementById('m_conn_id').value, billing_month = document.getElementById('m_month').value, previous_reading = document.getElementById('m_prev').value, current_reading = document.getElementById('m_curr').value;
            if(!connection_id || !billing_month || !previous_reading || !current_reading) return;
            const res = await fetch(`${API_BASE}/readings`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ connection_id, billing_month, previous_reading, current_reading }) });
            const data = await res.json();
            if(res.ok) { alert(data.message); window.location.reload(); } else alert(data.message);
        });
    });
});