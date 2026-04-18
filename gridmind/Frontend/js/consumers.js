document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    // 1. LOAD TABLE DATA
    function loadTable() {
        fetch(`${API_BASE}/consumers`)
            .then(res => res.json())
            .then(data => {
                tbody.innerHTML = '';
                data.forEach(row => {
                    const viewBtn = `<button class="btn-action btn-view" onclick="viewConsumer(${row.consumer_id})">Details</button>`;
                    const editBtn = `<button class="btn-action btn-edit" onclick="editConsumer(${row.consumer_id}, '${row.full_name}', '${row.address}', ${row.age})">Edit</button>`;
                    const deleteBtn = `<button class="btn-action btn-delete" onclick="deleteRecord('consumer', ${row.consumer_id})">Delete</button>`;
                    
                    tbody.innerHTML += `<tr>
                        <td>${row.consumer_id}</td>
                        <td>${row.full_name}</td>
                        <td>${row.address}</td>
                        <td>${row.age}</td>
                        <td class="action-icons">${viewBtn} ${editBtn} ${deleteBtn}</td>
                    </tr>`;
                });
            })
            .catch(err => console.error("Error fetching consumers:", err));
    }

    loadTable();

    // 2. ADD NEW CONSUMER MODAL
    const addBtn = document.querySelector('.btn-add');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            // Remove any existing modal first to prevent ID collisions
            const oldModal = document.getElementById('addConsModal');
            if(oldModal) oldModal.remove();

            const modalHtml = `
                <div id="addConsModal" class="modal-overlay dynamic-modal" style="display:flex;">
                    <div class="modal-content" style="max-width: 450px;">
                        <div class="modal-header">
                            <h2>Add New Consumer</h2>
                            <span class="close-btn" onclick="closeModal('addConsModal')">✕</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group"><label>Consumer ID</label><input type="number" id="m_cons_id" placeholder="Unique ID"></div>
                            <div class="form-group"><label>Age</label><input type="number" id="m_age" placeholder="Min 18"></div>
                        </div>
                        <div class="form-group"><label>Full Name</label><input type="text" id="m_name"></div>
                        <div class="form-group"><label>Email Address (Optional)</label><input type="email" id="consumerEmail" placeholder="user@example.com"></div>
                        <div class="form-group"><label>Permanent Address</label><input type="text" id="m_addr"></div>
                        <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid #e5e7eb;">
                        <h3 style="margin-bottom: 10px; color: #4B5563; font-size: 14px;">Portal Login Credentials</h3>
                        <div class="form-group"><label>Username</label><input type="text" id="m_username" placeholder="Unique login name"></div>
                        <div class="form-group"><label>Password</label><input type="password" id="m_password" placeholder="Min 8 char, 1 Upper, 1 Num, 1 Symbol"></div>
                        <button class="btn-primary" id="submitConsBtn" style="width: 100%; margin-top: 1rem;">Create Consumer Account</button>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            document.getElementById('submitConsBtn').addEventListener('click', async () => {
                const id = document.getElementById('m_cons_id').value;
                const name = document.getElementById('m_name').value;
                const email = document.getElementById('consumerEmail').value;
                const address = document.getElementById('m_addr').value;
                const age = document.getElementById('m_age').value;
                const username = document.getElementById('m_username').value;
                const password = document.getElementById('m_password').value;

                if(!id || !name || !address || !age || !username || !password) {
                    return alert("Please fill all required fields!");
                }

                if (!window.isValidPassword(password)) {
                    return alert("Password must contain at least 8 characters, 1 uppercase letter, 1 number, and 1 symbol.");
                }

                // Show loading state
                const btn = document.getElementById('submitConsBtn');
                btn.innerText = "Creating...";
                btn.disabled = true;

                try {
                    const res = await fetch(`${API_BASE}/consumers`, { 
                        method: 'POST', 
                        headers: {'Content-Type': 'application/json'}, 
                        body: JSON.stringify({id, name, email, address, age, username, password})
                    });
                    const data = await res.json();
                    
                    if(res.ok) {
                        alert("Consumer added successfully!");
                        window.location.reload(); 
                    } else {
                        alert("Error: " + (data.error || "Failed to add consumer."));
                        btn.innerText = "Create Consumer Account";
                        btn.disabled = false;
                    }
                } catch(e) { 
                    alert("Network Error: Could not connect to backend."); 
                    btn.innerText = "Create Consumer Account";
                    btn.disabled = false;
                }
            });
        });
    }
});