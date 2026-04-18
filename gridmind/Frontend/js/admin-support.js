const API_BASE = 'http://localhost:5000/api';

// Automatically load the tickets as soon as the page opens
document.addEventListener("DOMContentLoaded", loadAdminTickets);

let currentAdminTicketId = null;

async function loadAdminTickets() {
    try {
        const response = await fetch(`${API_BASE}/admin/tickets`);
        const tickets = await response.json();
        
        const tbody = document.getElementById("adminTicketsTableBody");
        if (!tbody) return;
        tbody.innerHTML = ""; 

        if (tickets.length === 0) {
            tbody.innerHTML = "<tr><td colspan='6' style='text-align: center;'>No active support tickets.</td></tr>";
            return;
        }

        tickets.forEach(t => {
            // Colors matching your admin dashboard badges
            let badgeClass = 'badge-gray';
            if (t.status === 'Open') badgeClass = 'badge-red'; // Needs attention!
            else if (t.status === 'In Progress') badgeClass = 'badge-blue';
            else if (t.status === 'Resolved') badgeClass = 'badge-green';
            
            const row = `
                <tr>
                    <td>#${t.ticket_id}</td>
                    <td><strong>${t.consumer_name}</strong> (ID: ${t.consumer_id})</td>
                    <td>${t.subject}</td>
                    <td>${t.created_at}</td>
                    <td><span class="badge ${badgeClass}">${t.status}</span></td>
                    <td><button class="pay-btn-table" onclick="openAdminChat(${t.ticket_id})">View / Reply</button></td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch (error) {
        console.error("Error fetching admin tickets:", error);
    }
}

// Ensure tickets load if the admin clicks the sidebar tab
// Note: If you have a specific showSection() function in your file, 
// you may want to call loadAdminTickets() inside that function when 'supportSection' is active.
document.addEventListener('click', (e) => {
    if (e.target.innerText.includes('Help Desk')) {
        loadAdminTickets();
    }
});

// --- 2. Open Chat Thread ---
async function openAdminChat(ticketId) {
    currentAdminTicketId = ticketId;
    document.getElementById("adminChatModal").style.display = "block";
    document.getElementById("adminChatBox").innerHTML = "Loading...";

    try {
        const response = await fetch(`${API_BASE}/tickets/${ticketId}/replies`);
        const data = await response.json();

        if (response.ok) {
            document.getElementById("adminChatSubject").innerText = `Ticket #${data.ticket.ticket_id}: ${data.ticket.subject}`;
            document.getElementById("adminChatStatus").innerText = `Status: ${data.ticket.status}`;
            
            const chatBox = document.getElementById("adminChatBox");
            chatBox.innerHTML = "";

            data.replies.forEach(reply => {
                const isAdmin = reply.sender_role === 'admin';
                // Admin sees their own messages on the right, consumer on the left
                const alignment = isAdmin ? 'margin-left: auto; text-align: right; background-color: #d1e7dd;' : 'margin-right: auto; text-align: left; background-color: #e2e3e5;';
                const senderName = isAdmin ? "You (Admin)" : data.ticket.consumer_name;

                chatBox.innerHTML += `
                    <div style="padding: 10px; margin-bottom: 10px; border-radius: 8px; max-width: 80%; ${alignment}">
                        <strong>${senderName}</strong><br>
                        ${reply.message}
                        <span style="font-size: 0.8em; color: #666; margin-top: 5px; display: block;">${reply.timestamp}</span>
                    </div>
                `;
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    } catch (error) {
        console.error("Error fetching thread:", error);
    }
}

// --- 3. Send Reply ---
async function sendAdminReply() {
    const message = document.getElementById("adminReplyMessage").value.trim();
    if (!message || !currentAdminTicketId) return;

    try {
        const response = await fetch(`${API_BASE}/tickets/${currentAdminTicketId}/reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ senderRole: "admin", message: message })
        });

        if (response.ok) {
            document.getElementById("adminReplyMessage").value = ""; 
            openAdminChat(currentAdminTicketId); // Reload thread
            loadAdminTickets(); // Refresh table (status auto-changes to 'In Progress')
        }
    } catch (error) {
        console.error("Error sending admin reply:", error);
    }
}

// --- 4. Mark Ticket Resolved ---
async function resolveTicket() {
    if (!currentAdminTicketId || !confirm("Are you sure you want to close this ticket?")) return;

    try {
        const response = await fetch(`${API_BASE}/admin/tickets/${currentAdminTicketId}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Resolved" })
        });

        if (response.ok) {
            alert("Ticket marked as Resolved.");
            openAdminChat(currentAdminTicketId); // Reload to show new status
            loadAdminTickets(); // Refresh table
        }
    } catch (error) {
        console.error("Error resolving ticket:", error);
    }
}

function closeAdminModal() { 
    document.getElementById("adminChatModal").style.display = "none"; 
    currentAdminTicketId = null;
}

// ... (rest of the openAdminChat, sendAdminReply, resolveTicket functions) ...