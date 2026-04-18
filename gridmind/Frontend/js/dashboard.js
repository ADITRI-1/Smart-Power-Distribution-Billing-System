window.submitAdminPasswordChange = async function() {
    const oldPassword = document.getElementById('adminOldPw').value;
    const newPassword = document.getElementById('adminNewPw').value;
    const username = localStorage.getItem('adminUsername') || 'admin';

    if (!oldPassword || !newPassword) return alert("Please fill in both password fields.");
    
    // STRICT VALIDATION
    if (!window.isValidPassword(newPassword)) {
        return alert("New password must contain at least 8 characters, 1 uppercase letter, 1 number, and 1 symbol.");
    }

    try {
        const response = await fetch('http://localhost:5000/api/admin/change-password', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, oldPassword, newPassword })
        });
        const data = await response.json();
        if (response.ok) { alert(data.message); closeAdminPasswordModal(); } 
        else { alert(data.error); }
    } catch (e) { alert("Server Error."); }
};