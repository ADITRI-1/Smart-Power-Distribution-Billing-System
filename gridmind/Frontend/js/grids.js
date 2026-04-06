document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';
    const tbody = document.querySelector('.data-table tbody');
    
    fetch(`${API_BASE}/grids`).then(res => res.json()).then(data => {
        tbody.innerHTML = '';
        data.forEach(row => {
            const editBtn = `<span class="action-edit" onclick="editGrid(${row.grid_id}, '${row.grid_name}', '${row.location}')">✎</span>`;
            tbody.innerHTML += `<tr><td>${row.grid_id}</td><td>${row.grid_name}</td><td>${row.location}</td><td class="action-icons">${editBtn} ${getDeleteBtn('power_grid', row.grid_id)}</td></tr>`;
        });
    });

    document.querySelector('.btn-add').addEventListener('click', () => {
        document.body.insertAdjacentHTML('beforeend', `<div id="addGridModal" class="modal-overlay" style="display:flex;"><div class="modal-content" style="max-width: 400px;"><div class="modal-header"><h2>Add Grid</h2><span class="close-btn" onclick="closeModal('addGridModal')">✕</span></div><div class="form-group"><label>Grid ID</label><input type="number" id="m_grid_id"></div><div class="form-group"><label>Grid Name</label><input type="text" id="m_name"></div><div class="form-group"><label>Location</label><input type="text" id="m_loc"></div><button class="btn-primary" id="submitGridBtn">Save</button></div></div>`);
        document.getElementById('submitGridBtn').addEventListener('click', async () => {
            const id = document.getElementById('m_grid_id').value, name = document.getElementById('m_name').value, loc = document.getElementById('m_loc').value;
            if(!id || !name || !loc) return;
            const res = await fetch(`${API_BASE}/grids`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, name, location: loc})});
            if(res.ok) window.location.reload(); else alert((await res.json()).error);
        });
    });
});

window.editGrid = function(id, currentName, currentLoc) {
    const API_BASE = 'http://localhost:5000/api';
    const modalHtml = `
        <div id="editGridModal" class="modal-overlay" style="display:flex;">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h2>Edit Power Grid #${id}</h2>
                    <span class="close-btn" onclick="closeModal('editGridModal')">✕</span>
                </div>
                <div class="form-group"><label>Grid Name</label><input type="text" id="e_grid_name" value="${currentName}"></div>
                <div class="form-group"><label>Location</label><input type="text" id="e_grid_loc" value="${currentLoc}"></div>
                <button class="btn-primary" id="updateGridBtn">Update Grid</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('updateGridBtn').addEventListener('click', async () => {
        const name = document.getElementById('e_grid_name').value;
        const location = document.getElementById('e_grid_loc').value;
        if(!name || !location) return alert("Please fill all fields!");

        try {
            const res = await fetch(`${API_BASE}/grids/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, location}) });
            if(res.ok) window.location.reload(); else alert("Error updating grid.");
        } catch(e) { alert("Server error"); }
    });
};