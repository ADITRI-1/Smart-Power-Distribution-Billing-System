document.addEventListener('DOMContentLoaded', () => {
    // 1. Scoped Variables
    const API_BASE = 'http://localhost:5000/api';
    let currentAdminTicketId = null;

    // Automatically load all grid tickets on page load
    fetchAllTickets();

    // --- Core Functions ---
    async function fetchAllTickets() {
        try {
            const response = await fetch(`${API_BASE}/admin/tickets`);
            const tickets = await response.json();
            
            const tbody = document.getElementById("adminTicketsTableBody");
            if (!tbody) return;
            tbody.innerHTML = ""; 

            if (tickets.length === 0) {
                tbody.innerHTML = "<tr><td colspan='6' style='text-align: center;'>No support tickets found.</td></tr>";
                return;
            }

            tickets.forEach(t => {
                // Determine Badge Color based on CSS classes
                let badgeClass = 'badge-gray';
                if (t.status === 'Open') badgeClass = 'badge-red';
                else if (t.status === 'In Progress') badgeClass = 'badge-blue';
                else if (t.status === 'Resolved') badgeClass = 'badge-green';
                
                tbody.innerHTML += `
                    <tr>
                        <td>#${t.ticket_id}</td>
                        <td><strong>${t.consumer_name}</strong><br><span style="font-size: 0.8em; color: #666;">ID: #${t.consumer_id}</span></td>
                        <td>${t.subject}</td>
                        <td>${t.created_at}</td>
                        <td><span class="badge ${badgeClass}">${t.status}</span></td>
                        <td>
                            <button onclick="openAdminChatThread(${t.ticket_id})" class="btn-view">View Thread</button>
                        </td>
                    </tr>
                `;
            });
        } catch (error) {
            console.error("Error fetching tickets:", error);
        }
    }

    // --- Chat Modal & Thread Logic ---
    window.openAdminChatThread = async function(ticketId) {
        currentAdminTicketId = ticketId;
        document.getElementById('adminChatModal').style.display = 'block';
        
        try {
            const response = await fetch(`${API_BASE}/tickets/${ticketId}/replies`);
            const data = await response.json();
            
            if (data.ticket) {
                // Update Modal Headers
                document.getElementById('adminChatSubject').innerText = `Ticket #${data.ticket.ticket_id}: ${data.ticket.subject}`;
                
                let badgeClass = 'badge-gray';
                if (data.ticket.status === 'Open') badgeClass = 'badge-red';
                else if (data.ticket.status === 'In Progress') badgeClass = 'badge-blue';
                else if (data.ticket.status === 'Resolved') badgeClass = 'badge-green';
                
                const statusSpan = document.getElementById('adminChatStatus');
                statusSpan.className = `badge ${badgeClass}`;
                statusSpan.innerText = data.ticket.status;
                
                // Populate Chat Box
                const chatBox = document.getElementById('adminChatBox');
                chatBox.innerHTML = '';
                
                data.replies.forEach(reply => {
                    // In the Admin View, the Admin is "self" (right side) and Consumer is "other" (left side)
                    const isSelf = reply.sender_role === 'admin';
                    const msgClass = isSelf ? 'msg-self' : 'msg-other';
                    const senderName = isSelf ? 'Admin Support' : data.ticket.consumer_name;
                    
                    chatBox.innerHTML += `
                        <div class="message ${msgClass}">
                            <strong>${senderName}</strong><br>
                            ${reply.message}
                            <span class="msg-time">${reply.timestamp}</span>
                        </div>
                    `;
                });
                
                // Auto-scroll to bottom of chat
                chatBox.scrollTop = chatBox.scrollHeight;
            }
        } catch (error) {
            console.error("Error fetching thread:", error);
        }
    }

    window.sendAdminReply = async function() {
        const message = document.getElementById("adminReplyMessage").value.trim();
        if (!message || !currentAdminTicketId) return;

        try {
            const response = await fetch(`${API_BASE}/tickets/${currentAdminTicketId}/reply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ senderRole: "admin", message: message }) // Notice senderRole is admin
            });

            if (response.ok) {
                document.getElementById("adminReplyMessage").value = ""; 
                openAdminChatThread(currentAdminTicketId); // Refresh thread
                fetchAllTickets(); // Refresh background table so status updates to "In Progress"
            }
        } catch (error) {
            console.error("Error sending reply:", error);
        }
    }

    // --- Resolve Ticket Logic ---
    window.resolveTicket = async function() {
        if (!currentAdminTicketId) return;
        
        if (confirm("Are you sure you want to mark this ticket as resolved?")) {
            try {
                const response = await fetch(`${API_BASE}/admin/tickets/${currentAdminTicketId}/status`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "Resolved" })
                });

                if (response.ok) {
                    openAdminChatThread(currentAdminTicketId); // Refresh modal to show green resolved badge
                    fetchAllTickets(); // Update background table
                }
            } catch (error) {
                console.error("Error resolving ticket:", error);
            }
        }
    }

    // Modal Display Controls
    window.closeAdminModal = function() { 
        document.getElementById("adminChatModal").style.display = "none"; 
        currentAdminTicketId = null;
    }
});

// ... (rest of the openAdminChat, sendAdminReply, resolveTicket functions) ...