document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault(); 
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const loginType = document.getElementById('loginType').value; 
            
            // Grab the Consumer ID (if it exists on the page)
            const consumerIdInput = document.getElementById('loginConsumerId');
            const consumerId = consumerIdInput ? consumerIdInput.value.trim() : null;

            try {
                const res = await fetch(`${API_BASE}/login`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ username, password, loginType, consumerId }) 
                });
                const data = await res.json();
                
                if (res.ok) {
                    if (data.role === 'admin') {
                        localStorage.setItem('adminUsername', data.username);
                        window.location.replace('dashboard.html');
                    } else if (data.role === 'consumer') {
                        localStorage.setItem('consumerId', data.consumer_id);
                        window.location.replace('consumer-dashboard.html');
                    }
                } else {
                    alert(data.error);
                }
            } catch (error) { alert("Server connectivity error."); }
        });
    }

    const resetForm = document.getElementById('resetForm');
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById('newPassword').value;
            
            // STRICT VALIDATION
            if (!window.isValidPassword(newPassword)) {
                return alert("Password must contain at least 8 characters, 1 uppercase letter, 1 number, and 1 symbol.");
            }

            const btn = document.getElementById('btn-reset-pw');
            btn.innerText = "Verifying..."; btn.disabled = true;

            try {
                const res = await fetch(`${API_BASE}/auth/reset-password`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        email: document.getElementById('resetEmail').value, 
                        token: document.getElementById('resetOtp').value, 
                        newPassword: newPassword, 
                        loginType: document.getElementById('loginType').value 
                    }) 
                });
                const data = await res.json();
                if (res.ok) { alert("Success! " + data.message); toggleForms('login'); } 
                else { alert("Error: " + data.error); }
            } catch (err) { alert("Network error."); } finally { btn.innerText = "Reset Password"; btn.disabled = false; }
        });
    }
    
    const forgotForm = document.getElementById('forgotForm');
    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-send-otp'); btn.innerText = "Sending..."; btn.disabled = true;
            try {
                const res = await fetch(`${API_BASE}/auth/forgot-password`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: document.getElementById('resetEmail').value, loginType: document.getElementById('loginType').value }) 
                });
                alert((await res.json()).message);
                if (res.ok) toggleForms('reset'); 
            } catch (err) { alert("Network error."); } finally { btn.innerText = "Send OTP"; btn.disabled = false; }
        });
    }
});

window.toggleForms = function(target) {
    document.getElementById('loginForm').style.display = target === 'login' ? 'block' : 'none';
    document.getElementById('forgot-link-container').style.display = target === 'login' ? 'block' : 'none';
    document.getElementById('forgotForm').style.display = target === 'forgot' ? 'block' : 'none';
    document.getElementById('resetForm').style.display = target === 'reset' ? 'block' : 'none';
};