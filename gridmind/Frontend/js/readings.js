document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';
    const tbody = document.querySelector('.data-table tbody');

    function loadReadings() {
        fetch(`${API_BASE}/readings`).then(res => res.json()).then(data => {
            tbody.innerHTML = '';
            data.forEach(row => { 
                const editBtn = `<span class="action-edit" style="cursor:pointer; margin-right:10px;" onclick="editReading(${row.reading_id}, ${row.previous_reading}, ${row.current_reading})" title="Edit Reading">✎</span>`;
                const delBtn = `<span class="action-delete" style="cursor:pointer; color:red;" onclick="deleteReading(${row.reading_id})" title="Delete Reading & Bill">🗑️</span>`;
                
                tbody.innerHTML += `<tr>
                    <td>${row.reading_id}</td>
                    <td>${row.connection_id}</td>
                    <td>${row.billing_month}</td>
                    <td>${row.previous_reading}</td>
                    <td>${row.current_reading}</td>
                    <td class="text-green">+${row.units_consumed}</td>
                    <td class="action-icons">${editBtn} ${delBtn}</td>
                </tr>`; 
            });
        });
    }

    loadReadings(); // Load on page open

    document.querySelector('.btn-add').addEventListener('click', async () => {
        const connections = await (await fetch(`${API_BASE}/connections`)).json();
        let connOptions = connections.filter(c => c.status === 'Active').map(c => `<option value="${c.connection_id}">Conn #${c.connection_id}</option>`).join('');
        
        // Calculate the maximum allowed month (Current Month)
        const currentMonth = new Date().toISOString().slice(0, 7);

        const modalHtml = `
            <div id="addReadingModal" class="modal-overlay" style="display:flex;">
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <h2>Log Meter Reading</h2>
                        <span class="close-btn" onclick="closeModal('addReadingModal')">✕</span>
                    </div>
                    <div class="form-group">
                        <label>Connection ID</label>
                        <select id="m_conn_id"><option value="">Select...</option>${connOptions}</select>
                    </div>
                    <div class="form-group">
                        <label>Month</label>
                        <input type="month" id="m_month" max="${currentMonth}">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group"><label>Prev Reading</label><input type="number" id="m_prev" placeholder="0"></div>
                        <div class="form-group"><label>Curr Reading</label><input type="number" id="m_curr" placeholder="0"></div>
                    </div>
                    <button class="btn-primary" id="submitReadingBtn" style="width:100%; margin-top:10px;">Submit</button>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        document.getElementById('submitReadingBtn').addEventListener('click', async () => {
            const connection_id = document.getElementById('m_conn_id').value;
            const billing_month = document.getElementById('m_month').value;
            const previous_reading = document.getElementById('m_prev').value;
            const current_reading = document.getElementById('m_curr').value;
            
            if(!connection_id || !billing_month || !previous_reading || !current_reading) return alert("Please fill all fields");
            
            if (billing_month > currentMonth) {
                return alert("You cannot log a reading for a future month!");
            }

            const res = await fetch(`${API_BASE}/readings`, { 
                method: 'POST', headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({ connection_id, billing_month, previous_reading, current_reading }) 
            });
            const data = await res.json();
            if(res.ok) { alert(data.message); window.location.reload(); } else alert(data.message || data.error);
        });
    });
});

// GLOBAL EDIT/DELETE FUNCTIONS
window.deleteReading = async function(readingId) {
    if(confirm(`WARNING: Deleting Reading #${readingId} will ALSO delete the generated Bill. Proceed?`)) {
        try {
            const res = await fetch(`http://localhost:5000/api/readings/${readingId}`, { method: 'DELETE' });
            const data = await res.json();
            if(res.ok) window.location.reload(); else alert(data.error);
        } catch(e) { alert("Server error."); }
    }
};

window.editReading = async function(id, curPrev, curCurr) {
    const modalHtml = `
        <div id="editReadingModal" class="modal-overlay" style="display:flex;">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h2>Edit Reading #${id}</h2>
                    <span class="close-btn" onclick="closeModal('editReadingModal')">✕</span>
                </div>
                <p style="font-size:12px; color:gray;">Updating reading values will recalculate and generate a new bill.</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top:15px;">
                    <div class="form-group"><label>Prev Reading</label><input type="number" id="e_prev" value="${curPrev}"></div>
                    <div class="form-group"><label>Curr Reading</label><input type="number" id="e_curr" value="${curCurr}"></div>
                </div>
                <button class="btn-primary" id="updateReadingBtn" style="width:100%; margin-top:10px;">Update & Recalculate Bill</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('updateReadingBtn').addEventListener('click', async () => {
        const previous_reading = document.getElementById('e_prev').value;
        const current_reading = document.getElementById('e_curr').value;
        if(!previous_reading || !current_reading) return alert("Fill all fields");

        try {
            const res = await fetch(`http://localhost:5000/api/readings/${id}`, { 
                method: 'PUT', headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({previous_reading, current_reading}) 
            });
            const data = await res.json();
            if(res.ok) window.location.reload(); else alert(data.error);
        } catch(e) { alert("Server error"); }
    });
};