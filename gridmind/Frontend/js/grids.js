document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    // 1. Load existing grids
    fetch(`${API_BASE}/grids`).then(res => res.json()).then(data => {
        tbody.innerHTML = '';
        data.forEach(row => {
            const editBtn = `<span class="action-edit" onclick="editGrid(${row.grid_id}, '${row.grid_name}', '${row.location}')" title="Edit">✎</span>`;
            tbody.innerHTML += `<tr><td>${row.grid_id}</td><td>${row.grid_name}</td><td>${row.location}</td><td class="action-icons">${editBtn} ${getDeleteBtn('power_grid', row.grid_id)}</td></tr>`;
        });
    });

    // 2. Add Grid Modal
    document.querySelector('.btn-add').addEventListener('click', () => {
        const modalHtml = `
            <div id="addGridModal" class="modal-overlay" style="display:flex;">
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <h2>Add Power Grid</h2>
                        <span class="close-btn" onclick="closeModal('addGridModal')">✕</span>
                    </div>
                    <div class="form-group">
                        <label>Grid ID</label>
                        <input type="number" id="m_grid_id" placeholder="e.g. 3">
                    </div>
                    <div class="form-group">
                        <label>Grid Name</label>
                        <input type="text" id="m_name" placeholder="e.g. East Grid">
                    </div>
                    <div class="form-group">
                        <label>Location</label>
                        <input type="text" id="m_loc" placeholder="e.g. Mumbai">
                    </div>
                    <button class="btn-primary" id="submitGridBtn">Save Grid</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('submitGridBtn').addEventListener('click', async () => {
            const id = document.getElementById('m_grid_id').value;
            const name = document.getElementById('m_name').value;
            const loc = document.getElementById('m_loc').value;
            if(!id || !name || !loc) return alert("Please fill all fields");
            
            try {
                const res = await fetch(`${API_BASE}/grids`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, name, location: loc})});
                const data = await res.json();
                if(res.ok) window.location.reload(); else alert(data.error || data.message);
            } catch(e) { alert("Server connectivity error."); }
        });
    });
});

window.editGrid = async function(id, currentName, currentLoc) {
    const name = prompt("Edit Grid Name:", currentName); if(!name) return;
    const location = prompt("Edit Location:", currentLoc); if(!location) return;
    try {
        const res = await fetch(`http://localhost:5000/api/grids/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, location}) });
        if(res.ok) window.location.reload(); else alert("Error updating grid.");
    } catch(e) { alert("Server error"); }
};