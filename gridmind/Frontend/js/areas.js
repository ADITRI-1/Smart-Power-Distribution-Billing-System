document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    // 1. LOAD TABLE DATA
    fetch(`${API_BASE}/areas`)
        .then(res => res.json())
        .then(data => {
            tbody.innerHTML = '';
            data.forEach(row => { 
                const editBtn = `<button class="btn-action btn-edit" onclick="editArea(${row.area_id}, '${row.zone}', '${row.city}', ${row.grid_id}, '${row.poc}')">Edit</button>`;
                const deleteBtn = `<button class="btn-action btn-delete" onclick="deleteRecord('distribution_area', ${row.area_id})">Delete</button>`;

                tbody.innerHTML += `<tr>
                    <td>${row.area_id}</td>
                    <td>${row.zone}</td>
                    <td>${row.city}</td>
                    <td>${row.grid_id}</td>
                    <td>${row.poc}</td>
                    <td class="action-icons">${editBtn} ${deleteBtn}</td>
                </tr>`; 
            });
        })
        .catch(err => console.error("Error fetching areas:", err));

    // 2. ADD NEW AREA MODAL
    const addBtn = document.querySelector('.btn-add');
    if (addBtn) {
        addBtn.addEventListener('click', async () => {
            try {
                const grids = await (await fetch(`${API_BASE}/grids`)).json();
                let gridOpts = grids.map(g => `<option value="${g.grid_id}" data-loc="${g.location}">${g.grid_name} (${g.location})</option>`).join('');
                
                const modalHtml = `
                    <div id="addAreaModal" class="modal-overlay dynamic-modal" style="display:flex;">
                        <div class="modal-content" style="max-width: 400px;">
                            <div class="modal-header">
                                <h2>Add Area</h2>
                                <span class="close-btn" onclick="closeModal('addAreaModal')">✕</span>
                            </div>
                            <div class="form-group"><label>Area ID</label><input type="number" id="m_area_id"></div>
                            <div class="form-group">
                                <label>Parent Grid</label>
                                <select id="m_grid_id" onchange="document.getElementById('m_city').value = this.options[this.selectedIndex].getAttribute('data-loc') || ''">
                                    <option value="" data-loc="">Select...</option>${gridOpts}
                                </select>
                            </div>
                            <div class="form-group"><label>City</label><input type="text" id="m_city" readonly style="background:#f3f4f6;"></div>
                            <div class="form-group"><label>Zone</label><input type="text" id="m_zone"></div>
                            <div class="form-group"><label>POC</label><input type="text" id="m_poc"></div>
                            <button class="btn-primary" id="submitAreaBtn">Save</button>
                        </div>
                    </div>`;
                document.body.insertAdjacentHTML('beforeend', modalHtml);

                document.getElementById('submitAreaBtn').addEventListener('click', async () => {
                    const id = document.getElementById('m_area_id').value;
                    const grid_id = document.getElementById('m_grid_id').value;
                    const city = document.getElementById('m_city').value;
                    const zone = document.getElementById('m_zone').value;
                    const poc = document.getElementById('m_poc').value;
                    
                    if(!id || !grid_id || !zone) return alert("Fill required fields!");
                    
                    const res = await fetch(`${API_BASE}/areas`, { 
                        method: 'POST', headers: {'Content-Type': 'application/json'}, 
                        body: JSON.stringify({id, grid_id, zone, city, poc})
                    });
                    if(res.ok) window.location.reload(); else alert((await res.json()).error);
                });
            } catch(e) { alert("Failed to fetch grids."); }
        });
    }
});