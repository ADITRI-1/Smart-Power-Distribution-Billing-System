// Inside js/readings.js modal HTML generation, replace the old inputs with this clean version:
const modalHtml = `
    <div id="addReadingModal" class="modal-overlay" style="display:flex;">
        <div class="modal-content" style="max-width: 450px;">
            <div class="modal-header">
                <h2>Log Meter Reading</h2>
                <span class="close-btn" onclick="closeModal('addReadingModal')">✕</span>
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
            <button class="btn-primary" id="submitReadingBtn">Submit Reading (Auto-Generates Bill)</button>
        </div>
    </div>
`;

// And update the fetch payload in the submit listener:
const res = await fetch(`${API_BASE}/readings`, { 
    method: 'POST', 
    headers: {'Content-Type': 'application/json'}, 
    body: JSON.stringify({ connection_id, billing_month, previous_reading, current_reading })
});