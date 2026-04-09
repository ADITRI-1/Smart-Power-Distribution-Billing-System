document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';

    // --- 1. LOGIN LOGIC ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault(); 
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const loginType = document.getElementById('loginType').value; 
            try {
                const res = await fetch(`${API_BASE}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, loginType }) });
                const data = await res.json();
                if (res.ok) {
                    if (data.role === 'admin') window.location.replace('dashboard.html');
                    else if (data.role === 'consumer') {
                        localStorage.setItem('consumerId', data.consumer_id);
                        window.location.replace('consumer-dashboard.html');
                    }
                } else alert(data.error);
            } catch (error) { alert("Server connectivity error."); }
        });
    }

    // --- 2. FORGOT PASSWORD LOGIC ---
    const forgotForm = document.getElementById('forgotForm');
    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('resetEmail').value;
            const btn = document.getElementById('btn-send-otp');
            btn.innerText = "Sending..."; btn.disabled = true;

            try {
                const res = await fetch(`${API_BASE}/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email, loginType: document.getElementById('loginType').value }) 
                });
                const data = await res.json();
                alert(data.message);
                
                if (res.ok) {
                    toggleForms('reset'); 
                }
            } catch (err) {
                alert("Network error connecting to backend.");
            } finally {
                btn.innerText = "Send OTP"; btn.disabled = false;
            }
        });
    }

    const resetForm = document.getElementById('resetForm');
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('resetEmail').value; 
            const token = document.getElementById('resetOtp').value;
            const newPassword = document.getElementById('newPassword').value;
            const btn = document.getElementById('btn-reset-pw');
            
            btn.innerText = "Verifying..."; btn.disabled = true;

            try {
                const res = await fetch(`${API_BASE}/auth/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, token, newPassword, loginType: document.getElementById('loginType').value }) 
                });
                const data = await res.json();
                
                if (res.ok) {
                    alert("Success! " + data.message + " You can now log in.");
                    toggleForms('login');
                } else {
                    alert("Error: " + data.error);
                }
            } catch (err) {
                alert("Network error.");
            } finally {
                btn.innerText = "Reset Password"; btn.disabled = false;
            }
        });
    }
});

window.toggleForms = function(target) {
    document.getElementById('loginForm').style.display = target === 'login' ? 'block' : 'none';
    document.getElementById('forgot-link-container').style.display = target === 'login' ? 'block' : 'none';
    document.getElementById('forgotForm').style.display = target === 'forgot' ? 'block' : 'none';
    document.getElementById('resetForm').style.display = target === 'reset' ? 'block' : 'none';
};