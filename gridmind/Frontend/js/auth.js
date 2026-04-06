document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';

    // --- LOGIN FORM LOGIC ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault(); 
            
            const usernameEl = document.getElementById('username');
            const passwordEl = document.getElementById('password');
            const loginTypeEl = document.getElementById('loginType');

            if (!usernameEl || !passwordEl || !loginTypeEl) return;

            const username = usernameEl.value.trim();
            const password = passwordEl.value;
            const loginType = loginTypeEl.value; 

            try {
                const response = await fetch(`${API_BASE}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, loginType })
                });

                const data = await response.json();

                if (response.ok) {
                    if (data.role === 'admin') {
                        window.location.replace('dashboard.html');
                    } else if (data.role === 'consumer') {
                        localStorage.setItem('consumerId', data.consumer_id);
                        window.location.replace('consumer-dashboard.html');
                    }
                } else {
                    alert(data.error || 'Login failed! Check your credentials.');
                }
            } catch (error) {
                alert("Cannot connect to the backend server. Is Python running on port 5000?");
            }
        });
    }

    // --- SIGNUP FORM LOGIC ---
    const signupForm = document.querySelector('form[action="#"]'); 
    if (signupForm && window.location.pathname.includes('signup')) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const fullname = document.getElementById('fullname').value.trim();
            const username = document.getElementById('reg_username').value.trim();
            const password = document.getElementById('reg_password').value;

            try {
                const response = await fetch(`${API_BASE}/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fullname, username, password })
                });
                
                if (response.ok) {
                    alert('Account created successfully! You can now log in.');
                    window.location.replace('login-consumer.html');
                } else {
                    const data = await response.json();
                    alert(data.error || 'Signup failed.');
                }
            } catch (error) {
                alert("Cannot connect to the backend server.");
            }
        });
    }
});