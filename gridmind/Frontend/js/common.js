const API_BASE = 'http://localhost:5000/api';

// --- PASSWORD VALIDATOR HELPER ---
window.isValidPassword = function(password) {
    const regex = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    return regex.test(password);
};

// ==========================================
// 1. DYNAMIC PAGE ROUTER & TABLE RENDERER
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.toLowerCase();
    const tbody = document.querySelector('.data-table tbody');

    // Make the delete button generator globally accessible
    window.getDeleteBtn = function(table, id) {
        return `<button class="btn-action btn-delete" onclick="deleteRecord('${table}', ${id})">Delete</button>`;
    };

    // ADMIN: CONSUMERS (Adding the password check here)
    if (path.includes('consumers.html') && tbody) {
        const addBtn = document.querySelector('.btn-add');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const modalHtml = `
                    <div id="addConsModal" class="modal-overlay" style="display:flex;">
                        <div class="modal-content" style="max-width: 450px;">
                            <div class="modal-header">
                                <h2>Add New Consumer</h2>
                                <span class="close-btn" onclick="closeModal('addConsModal')">✕</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group"><label>Consumer ID</label><input type="number" id="m_cons_id"></div>
                                <div class="form-group"><label>Age</label><input type="number" id="m_age"></div>
                            </div>
                            <div class="form-group"><label>Full Name</label><input type="text" id="m_name"></div>
                            <div class="form-group"><label>Email Address</label><input type="email" id="consumerEmail" placeholder="e.g. user@example.com"></div>
                            <div class="form-group"><label>Permanent Address</label><input type="text" id="m_addr"></div>
                            
                            <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid #e5e7eb;">
                            
                            <h3 style="margin-bottom: 10px; color: #4B5563; font-size: 14px;">Portal Login Credentials</h3>
                            <div class="form-group"><label>Username</label><input type="text" id="m_username" placeholder="e.g. jdoe_123"></div>
                            <div class="form-group"><label>Password (Min 8 char, 1 Upper, 1 Number, 1 Symbol)</label><input type="password" id="m_password"></div>
                            
                            <button class="btn-primary" id="submitConsBtn" style="width: 100%; margin-top: 1rem;">Create Consumer</button>
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

                    if(!id || !name || !address || !age || !username || !password) return alert("Fill all fields!");

                    // FRONTEND PASSWORD CHECK
                    if (!window.isValidPassword(password)) {
                        return alert("Password must contain at least 8 characters, 1 uppercase letter, 1 number, and 1 symbol.");
                    }

                    try {
                        const res = await fetch(`${API_BASE}/consumers`, { 
                            method: 'POST', 
                            headers: {'Content-Type': 'application/json'}, 
                            body: JSON.stringify({id, name, email, address, age, username, password})
                        });
                        const data = await res.json();
                        if(res.ok) window.location.reload(); else alert(data.error);
                    } catch(e) { alert("Server Error."); }
                });
            });
        }
    }
});

// =========================================================
// 2. AUTOMATIC UI UPGRADER (Converts hardcoded Emojis)
// =========================================================
function upgradeUIButtons() {
    document.querySelectorAll('span.action-edit').forEach(el => {
        const btn = document.createElement('button'); btn.className = 'btn-action btn-edit'; btn.innerText = 'Edit';
        if (el.hasAttribute('onclick')) btn.setAttribute('onclick', el.getAttribute('onclick'));
        el.replaceWith(btn);
    });
    document.querySelectorAll('span.action-view').forEach(el => {
        const btn = document.createElement('button'); btn.className = 'btn-action btn-view'; btn.innerText = 'Details';
        if (el.hasAttribute('onclick')) btn.setAttribute('onclick', el.getAttribute('onclick'));
        el.replaceWith(btn);
    });
    document.querySelectorAll('span.action-delete').forEach(el => {
        const btn = document.createElement('button'); btn.className = 'btn-action btn-delete'; btn.innerText = 'Delete';
        if (el.hasAttribute('onclick')) btn.setAttribute('onclick', el.getAttribute('onclick'));
        el.replaceWith(btn);
    });
}
document.addEventListener("DOMContentLoaded", () => {
    upgradeUIButtons(); 
    const observer = new MutationObserver(upgradeUIButtons);
    observer.observe(document.body, { childList: true, subtree: true });
});

// =========================================================
// 3. GLOBAL ACTIONS (Delete, Logout, Modals)
// =========================================================
window.deleteRecord = async function(tableName, recordId) {
    if(confirm(`Are you sure you want to delete this record?`)) {
        try { 
            const res = await fetch(`${API_BASE}/delete/${tableName}/${recordId}`, { method: 'DELETE' }); 
            const data = await res.json();
            if(res.ok) window.location.reload(); else alert(data.error || "Cannot delete."); 
        } catch(e) { alert("Server error."); }
    }
};

window.deleteReading = async function(readingId) {
    if(confirm(`WARNING: Deleting this reading will ALSO delete the generated Bill. Proceed?`)) {
        try {
            const res = await fetch(`${API_BASE}/readings/${readingId}`, { method: 'DELETE' });
            if(res.ok) window.location.reload(); else alert((await res.json()).error);
        } catch(e) { alert("Server error."); }
    }
};

window.logout = function() {
    localStorage.removeItem('consumerId');
    localStorage.removeItem('adminUsername');
    if (window.location.pathname.toLowerCase().includes('consumer')) window.location.replace("login-consumer.html");
    else window.location.replace("login-admin.html");
};

window.closeModal = function(modalId) {
    if(modalId) document.getElementById(modalId).style.display = "none";
    else document.querySelectorAll('.modal-overlay, .modal').forEach(m => m.style.display = 'none');
};