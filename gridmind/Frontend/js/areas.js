// js/areas.js
document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    // 1. Fetch and render existing areas
    fetch(`${API_BASE}/areas`).then(res => res.json()).then(data => {
        tbody.innerHTML = '';
        data.forEach(row => { 
            const editBtn = `<span class="action-edit" onclick="editArea(${row.area_id}, '${row.zone}', '${row.city}', ${row.grid_id}, '${row.poc}')" title="Edit">✎</span>`;
            tbody.innerHTML += `<tr><td>${row.area_id}</td><td>${row.zone}</td><td>${row.city}</td><td>${row.grid_id}</td><td>${row.poc}</td><td class="action-icons">${editBtn} ${getDeleteBtn('distribution_area', row.area_id)}</td></tr>`; 
        });
    });

    // 2. Add Area (Dynamic Modal with Grids Dropdown)
    document.querySelector('.btn-add').addEventListener('click', async () => {
        try {
            // Fetch grids from the database to populate the dropdown
            const gridsRes = await fetch(`${API_BASE}/grids`);
            const grids = await gridsRes.json();
            
            // Build the <option> list
            let gridOptions = grids.map(g => `<option value="${g.grid_id}" data-loc="${g.location}">${g.grid_name} (${g.location})</option>`).join('');

            const modalHtml = `
                <div id="addAreaModal" class="modal-overlay" style="display:flex;">
                    <div class="modal-content" style="max-width: 400px;">
                        <div class="modal-header">
                            <h2>Add Distribution Area</h2>
                            <span class="close-btn" onclick="closeModal('addAreaModal')">✕</span>
                        </div>
                        <div class="form-group">
                            <label>Area ID</label>
                            <input type="number" id="m_area_id" placeholder="e.g. 301">
                        </div>
                        <div class="form-group">
                            <label>Parent Power Grid</label>
                            <select id="m_grid_id" onchange="document.getElementById('m_city').value = this.options[this.selectedIndex].getAttribute('data-loc') || ''">
                                <option value="" data-loc="">Select a Grid...</option>
                                ${gridOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>City (Auto-fetched from Grid)</label>
                            <input type="text" id="m_city" readonly style="background: #f3f4f6; color: #6B7280; cursor: not-allowed;">
                        </div>
                        <div class="form-group">
                            <label>Zone Name</label>
                            <input type="text" id="m_zone" placeholder="e.g. North Zone">
                        </div>
                        <div class="form-group">
                            <label>Point of Contact (POC)</label>
                            <input type="text" id="m_poc" placeholder="e.g. John Doe">
                        </div>
                        <button class="btn-primary" id="submitAreaBtn">Save Area</button>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // Handle the save button click
            document.getElementById('submitAreaBtn').addEventListener('click', async () => {
                const id = document.getElementById('m_area_id').value;
                const grid_id = document.getElementById('m_grid_id').value;
                const city = document.getElementById('m_city').value;
                const zone = document.getElementById('m_zone').value;
                const poc = document.getElementById('m_poc').value;

                if(!id || !grid_id || !zone || !city) return alert("Please fill all required fields!");

                const res = await fetch(`${API_BASE}/areas`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, grid_id, zone, city, poc})});
                const data = await res.json();
                if(res.ok) window.location.reload(); else alert(data.error);
            });
        } catch(e) {
            alert("Failed to load grids. Ensure the server is running.");
        }
    });
});

window.editArea = async function(id, currentZone, currentCity, currentGridId, currentPoc) {
    const zone = prompt("Edit Zone:", currentZone); if(!zone) return;
    const city = prompt("Edit City:", currentCity); if(!city) return;
    const grid_id = prompt("Edit Parent Grid ID:", currentGridId); if(!grid_id) return;
    const poc = prompt("Edit POC:", currentPoc);
    try {
        const res = await fetch(`${API_BASE}/areas/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({zone, city, grid_id, poc}) });
        if(res.ok) window.location.reload(); else alert("Error updating area.");
    } catch(e) { alert("Server error"); }
};