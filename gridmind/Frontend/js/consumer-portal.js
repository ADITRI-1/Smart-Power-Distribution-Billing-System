document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('p_name').value;
    const address = document.getElementById('p_address').value;
    const age = document.getElementById('p_age').value;
    const password = document.getElementById('p_password').value;

    // STRICT VALIDATION
    if (password && !window.isValidPassword(password)) {
        return alert("New password must contain at least 8 characters, 1 uppercase letter, 1 number, and 1 symbol.");
    }

    try {
        const res = await fetch(`${API_BASE}/consumer/${consumerId}/profile`, { 
            method: 'PUT', headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({name, address, age, password}) 
        });
        const result = await res.json();
        alert(result.message || result.error);
        if(res.ok) document.getElementById('p_password').value = '';
    } catch(err) { alert("Server error."); }
});