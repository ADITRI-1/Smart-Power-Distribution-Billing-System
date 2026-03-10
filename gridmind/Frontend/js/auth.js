document.addEventListener('DOMContentLoaded', () => {
    
    // --- LOGIN LOGIC ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault(); 
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('http://localhost:5000/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    window.location.href = 'dashboard.html';
                } else {
                    alert(data.error || 'Login failed');
                }
            } catch (error) {
                console.error("Error:", error);
                alert("Cannot connect to server.");
            }
        });
    }

    // --- SIGNUP LOGIC ---
    const signupForm = document.querySelector('form[action="#"]'); // Grabbing the form on signup.html
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

                const data = await response.json();

                if (response.ok) {
                    alert('Signup successful! You can now log in.');
                    window.location.href = 'index.html'; // Redirect to login
                } else {
                    alert(data.error || 'Signup failed');
                }
            } catch (error) {
                console.error("Error:", error);
                alert("Cannot connect to server.");
            }
        });
    }
});