document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';
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

    const signupForm = document.querySelector('form[action="#"]'); 
    if (signupForm && window.location.pathname.includes('signup')) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const fullname = document.getElementById('fullname').value.trim();
            const username = document.getElementById('reg_username').value.trim();
            const password = document.getElementById('reg_password').value;
            try {
                const res = await fetch(`${API_BASE}/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullname, username, password }) });
                if (res.ok) { alert('Account created! Please log in.'); window.location.replace('login-consumer.html'); }
                else { const data = await res.json(); alert(data.error); }
            } catch (error) { alert("Server connectivity error."); }
        });
    }
});