document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';
    
    // Security check: Make sure an admin is actually logged in!
    const adminUser = localStorage.getItem('adminUsername');
    if (!adminUser) {
        window.location.replace('login-admin.html');
        return;
    }

    // Fetch High-Level Stats
    fetch(`${API_BASE}/admin/dashboard`)
        .then(res => {
            if (!res.ok) throw new Error("Failed to fetch dashboard stats.");
            return res.json();
        })
        .then(data => {
            document.getElementById('dash-grids').innerText = data.total_grids || 0;
            document.getElementById('dash-areas').innerText = data.total_areas || 0;
            document.getElementById('dash-consumers').innerText = data.total_consumers || 0;
            document.getElementById('dash-conns').innerText = data.total_connections || 0;
            document.getElementById('dash-units').innerText = parseFloat(data.total_units_supplied || 0).toLocaleString();
        })
        .catch(e => {
            console.error("Dashboard Stats Error:", e);
            alert("Could not load dashboard stats. Check your Flask backend console for errors.");
        });

    // Fetch Charts
    fetch(`${API_BASE}/analytics`)
        .then(res => res.json())
        .then(data => {
            if (!data.power_loss || data.power_loss.length === 0) return;
            const zones = data.power_loss.map(item => item.zone); 
            const consumedData = data.power_loss.map(item => parseFloat(item.units_consumed)); 
            const suppliedData = data.power_loss.map(item => parseFloat(item.units_supplied));
            
            new Chart(document.getElementById('dashPieChart').getContext('2d'), { 
                type: 'pie', 
                data: { labels: zones, datasets: [{ data: consumedData, backgroundColor: ['#2563EB', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6'], borderWidth: 1 }] }, 
                options: { responsive: true, maintainAspectRatio: false } 
            });
            new Chart(document.getElementById('dashBarChart').getContext('2d'), { 
                type: 'bar', 
                data: { labels: zones, datasets: [ { label: 'Supplied', data: suppliedData, backgroundColor: '#2563EB' }, { label: 'Consumed', data: consumedData, backgroundColor: '#10B981' } ] }, 
                options: { responsive: true, maintainAspectRatio: false } 
            });
        })
        .catch(e => console.error("Chart Rendering Error:", e));
});

// Admin Password Change Modal Actions
window.openAdminPasswordModal = function() { 
    document.getElementById('adminPasswordModal').style.display = 'flex'; 
};
window.closeAdminPasswordModal = function() { 
    document.getElementById('adminPasswordModal').style.display = 'none';
    document.getElementById('adminOldPw').value = ''; 
    document.getElementById('adminNewPw').value = '';
};

window.submitAdminPasswordChange = async function() {
    const oldPassword = document.getElementById('adminOldPw').value;
    const newPassword = document.getElementById('adminNewPw').value;
    const username = localStorage.getItem('adminUsername');

    if (!oldPassword || !newPassword) return alert("Please fill in both password fields.");
    if (!window.isValidPassword(newPassword)) return alert("New password must contain at least 8 characters, 1 uppercase letter, 1 number, and 1 symbol.");

    try {
        const response = await fetch('http://localhost:5000/api/admin/change-password', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, oldPassword, newPassword })
        });
        const data = await response.json();
        if (response.ok) { 
            alert(data.message); 
            closeAdminPasswordModal(); 
        } else { 
            alert(data.error); 
        }
    } catch (e) { alert("Server Error."); }
};