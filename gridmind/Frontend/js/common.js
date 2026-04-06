const API_BASE = 'http://localhost:5000/api';

window.deleteRecord = async function(tableName, recordId) {
    if(confirm(`Are you sure you want to delete record ID ${recordId} from ${tableName}?`)) {
        try { 
            const res = await fetch(`${API_BASE}/delete/${tableName}/${recordId}`, { method: 'DELETE' }); 
            const data = await res.json();
            if(res.ok) window.location.reload(); else alert(data.error || "Cannot delete."); 
        } catch(e) { alert("Server error."); }
    }
};

const getDeleteBtn = (table, id) => `<span class="action-delete" onclick="deleteRecord('${table}', ${id})" title="Delete">🗑️</span>`;

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.remove();
};