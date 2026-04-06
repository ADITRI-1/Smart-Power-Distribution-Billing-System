document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    // 1. Load existing readings
    fetch(`${API_BASE}/readings`).then(res => res.json()).then(data => {
        tbody.innerHTML = '';
        data.forEach(row => { 
            tbody.innerHTML += `<tr><td>${row.reading_id}</td><td>${row.connection_id}</td><td>${row.billing_month}</td><td>${row.previous_reading}</td><td>${row.current_reading}</td><td class="text-green">+${row.units_consumed}</td></tr>`; 
        });
    });

    // 2. Add Reading Modal (with Connection Dropdown)
    document.querySelector('.btn-add').addEventListener('click', async () => {
        try {
            // Fetch Connections to populate the dropdown
            const connRes = await fetch(`${API_BASE}/connections`);
            const connections = await connRes.json();
            
            // Only show active connections in the dropdown
            let connOptions = connections
                .filter(c => c.status === 'Active')
                .map(c => `<option value="${c.connection_id}">Conn #${c.connection_id} (Load: ${c.load})</option>`)
                .join('');

            const modalHtml = `
                <div id="addReadingModal" class="modal-overlay" style="display:flex;">
                    <div class="modal-content" style="max-width: 450px;">
                        <div class="modal-header">
                            <h2>Log Meter Reading</h2>
                            <span class="close-btn" onclick="closeModal('addReadingModal')">✕</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group"><label>Reading ID</label><input type="number" id="m_read_id" placeholder="e.g. 10"></div>
                            <div class="form-group"><label>Target Bill ID</label><input type="number" id="m_bill_id" placeholder="e.g. 8005"></div>
                        </div>
                        <div class="form-group">
                            <label>Connection ID</label>
                            <select id="m_conn_id">
                                <option value="">Select a Connection...</option>
                                ${connOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Billing Month</label>
                            <input type="month" id="m_month">
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group"><label>Prev Reading</label><input type="number" id="m_prev" placeholder="0"></div>
                            <div class="form-group"><label>Curr Reading</label><input type="number" id="m_curr" placeholder="0"></div>
                        </div>
                        <button class="btn-primary" id="submitReadingBtn">Submit Reading & Generate Bill</button>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            document.getElementById('submitReadingBtn').addEventListener('click', async () => {
                const reading_id = document.getElementById('m_read_id').value;
                const bill_id = document.getElementById('m_bill_id').value;
                const connection_id = document.getElementById('m_conn_id').value;
                const billing_month = document.getElementById('m_month').value;
                const previous_reading = document.getElementById('m_prev').value;
                const current_reading = document.getElementById('m_curr').value;

                if(!reading_id || !bill_id || !connection_id || !billing_month || !previous_reading || !current_reading) {
                    return alert("Please fill all required fields!");
                }

                try {
                    const res = await fetch(`${API_BASE}/readings`, { 
                        method: 'POST', 
                        headers: {'Content-Type': 'application/json'}, 
                        body: JSON.stringify({
                            reading_id, connection_id, billing_month, previous_reading, current_reading, bill_id
                        })
                    });
                    const data = await res.json();
                    
                    if(res.ok) {
                        alert(data.message); // Shows "Bill generated successfully"
                        window.location.reload(); 
                    } else {
                        alert(data.error || data.message); // Shows trigger continuity errors
                    }
                } catch(e) { alert("Server connectivity error."); }
            });
        } catch (e) {
            alert("Failed to load connections.");
        }
    });
});