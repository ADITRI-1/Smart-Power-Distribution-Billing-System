document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    // 1. LOAD TABLE DATA
    fetch(`${API_BASE}/grids`)
        .then(res => res.json())
        .then(data => {
            tbody.innerHTML = '';
            data.forEach(row => {
                const editBtn = `<button class="btn-action btn-edit" onclick="editGrid(${row.grid_id}, '${row.grid_name}', '${row.location}')">Edit</button>`;
                const deleteBtn = `<button class="btn-action btn-delete" onclick="deleteRecord('power_grid', ${row.grid_id})">Delete</button>`;

                tbody.innerHTML += `<tr>
                    <td>${row.grid_id}</td>
                    <td>${row.grid_name}</td>
                    <td>${row.location}</td>
                    <td class="action-icons">${editBtn} ${deleteBtn}</td>
                </tr>`;
            });
        })
        .catch(err => console.error("Error fetching grids:", err));

    // 2. ADD NEW GRID MODAL
    const addBtn = document.querySelector('.btn-add');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const modalHtml = `
                <div id="addGridModal" class="modal-overlay dynamic-modal" style="display:flex;">
                    <div class="modal-content" style="max-width: 400px;">
                        <div class="modal-header">
                            <h2>Add Grid</h2>
                            <span class="close-btn" onclick="closeModal('addGridModal')">✕</span>
                        </div>
                        <div class="form-group"><label>Grid ID</label><input type="number" id="m_grid_id"></div>
                        <div class="form-group"><label>Grid Name</label><input type="text" id="m_name"></div>
                        <div class="form-group"><label>Location</label><input type="text" id="m_loc"></div>
                        <button class="btn-primary" id="submitGridBtn">Save</button>
                    </div>
                </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            document.getElementById('submitGridBtn').addEventListener('click', async () => {
                const id = document.getElementById('m_grid_id').value;
                const name = document.getElementById('m_name').value;
                const loc = document.getElementById('m_loc').value;
                
                if(!id || !name || !loc) return alert("Fill all fields!");
                
                const res = await fetch(`${API_BASE}/grids`, { 
                    method: 'POST', headers: {'Content-Type': 'application/json'}, 
                    body: JSON.stringify({id, name, location: loc})
                });
                if(res.ok) window.location.reload(); else alert((await res.json()).error);
            });
        });
    }
});