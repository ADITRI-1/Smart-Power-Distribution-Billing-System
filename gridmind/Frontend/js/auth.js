document.addEventListener('DOMContentLoaded', () => {

    // --- LOGIN FORM LOGIC ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault(); // Stop the page from reloading
            
            const usernameEl = document.getElementById('username');
            const passwordEl = document.getElementById('password');
            const loginTypeEl = document.getElementById('loginType');

            // Safety check to ensure HTML is correct
            if (!usernameEl || !passwordEl || !loginTypeEl) {
                alert("Form Configuration Error: Missing input fields.");
                return;
            }

            const username = usernameEl.value;
            const password = passwordEl.value;
            const loginType = loginTypeEl.value; 

            try {
                // Try to connect to your Python Backend
                const response = await fetch('http://localhost:5000/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, loginType })
                });

                const data = await response.json();

                if (response.ok) {
                    if (data.role === 'admin') {
                        window.location.replace('dashboard.html');
                    } else {
                        localStorage.setItem('consumerId', data.consumer_id);
                        window.location.replace('consumer-dashboard.html');
                    }
                } else {
                    alert(data.error || 'Login failed! Check your credentials.');
                }
            } catch (error) {
                console.warn("Backend offline, trying offline fallback mode...");
                
                // Offline Fallback Data
                if (loginType === 'admin' && username === 'gaurav' && password === 'admin') {
                    window.location.replace('dashboard.html');
                } else if (loginType === 'consumer' && username === 'gaurav' && password === 'consumer') {
                    localStorage.setItem('consumerId', '1002');
                    window.location.replace('consumer-dashboard.html');
                } else {
                    alert(`Server is offline. Invalid credentials. (Hint: Use gaurav / ${loginType})`);
                }
            }
        });
    }

    // --- SIGNUP FORM LOGIC ---
    const signupForm = document.querySelector('form[action="#"]'); 
    if (signupForm && window.location.pathname.includes('signup')) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const fullname = document.getElementById('fullname').value;
            const username = document.getElementById('reg_username').value;
            const password = document.getElementById('reg_password').value;

            try {
                const response = await fetch('http://localhost:5000/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fullname, username, password })
                });
                
                if (response.ok) {
                    alert('Consumer account created successfully! You can now log in.');
                    window.location.replace('login-consumer.html');
                } else {
                    const data = await response.json();
                    alert(data.error || 'Signup failed');
                }
            } catch (error) {
                alert("Cannot connect to the backend server to sign up.");
            }
        });
    }
});