document.addEventListener('DOMContentLoaded', () => {
    let currentAdminTicketId = null;

    fetchAllTickets();

    async function fetchAllTickets() {
        try {
            const response = await fetch(`${API_BASE}/admin/tickets`);
            const tickets = await response.json();
            const tbody = document.getElementById("adminTicketsTableBody");
            if (!tbody) return;
            tbody.innerHTML = ""; 

            if (tickets.length === 0) return tbody.innerHTML = "<tr><td colspan='6' style='text-align: center;'>No support tickets found.</td></tr>";

            tickets.forEach(t => {
                let badgeClass = 'badge-gray';
                if (t.status === 'Open') badgeClass = 'badge-red';
                else if (t.status === 'In Progress') badgeClass = 'badge-blue';
                else if (t.status === 'Resolved') badgeClass = 'badge-green';
                
                // BEAUTIFUL THREAD BUTTON
                const viewBtn = `<button class="btn-action btn-thread" onclick="openAdminChatThread(${t.ticket_id})">View Thread</button>`;

                tbody.innerHTML += `
                    <tr>
                        <td>#${t.ticket_id}</td>
                        <td><strong>${t.consumer_name}</strong><br><span style="font-size: 0.8em; color: #666;">ID: #${t.consumer_id}</span></td>
                        <td>${t.subject}</td>
                        <td>${t.created_at}</td>
                        <td><span class="badge ${badgeClass}">${t.status}</span></td>
                        <td class="action-icons">${viewBtn}</td>
                    </tr>
                `;
            });
        } catch (error) { console.error("Error fetching tickets:", error); }
    }

    window.openAdminChatThread = async function(ticketId) {
        currentAdminTicketId = ticketId;
        document.getElementById('adminChatModal').style.display = 'flex'; 
        
        try {
            const response = await fetch(`${API_BASE}/tickets/${ticketId}/replies`);
            const data = await response.json();
            
            if (data.ticket) {
                document.getElementById('adminChatSubject').innerText = `Ticket #${data.ticket.ticket_id}: ${data.ticket.subject}`;
                
                let badgeClass = 'badge-gray';
                if (data.ticket.status === 'Open') badgeClass = 'badge-red';
                else if (data.ticket.status === 'In Progress') badgeClass = 'badge-blue';
                else if (data.ticket.status === 'Resolved') badgeClass = 'badge-green';
                
                const statusSpan = document.getElementById('adminChatStatus');
                statusSpan.className = `badge ${badgeClass}`;
                statusSpan.innerText = data.ticket.status;
                
                const chatBox = document.getElementById('adminChatBox');
                chatBox.innerHTML = '';
                
                data.replies.forEach(reply => {
                    const isSelf = reply.sender_role === 'admin';
                    const msgClass = isSelf ? 'msg-consumer' : 'msg-admin';
                    const senderName = isSelf ? 'Admin Support' : data.ticket.consumer_name;
                    chatBox.innerHTML += `
                        <div class="message ${msgClass}">
                            <strong>${senderName}</strong><br>
                            ${reply.message}
                            <span class="msg-time">${reply.timestamp}</span>
                        </div>
                    `;
                });
                chatBox.scrollTop = chatBox.scrollHeight;
            }
        } catch (error) { console.error("Error fetching thread:", error); }
    }

    window.sendAdminReply = async function() {
        const message = document.getElementById("adminReplyMessage").value.trim();
        if (!message || !currentAdminTicketId) return;

        try {
            const response = await fetch(`${API_BASE}/tickets/${currentAdminTicketId}/reply`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ senderRole: "admin", message: message }) 
            });
            if (response.ok) {
                document.getElementById("adminReplyMessage").value = ""; 
                openAdminChatThread(currentAdminTicketId); 
                fetchAllTickets(); 
            }
        } catch (error) { console.error("Error sending reply:", error); }
    }

    window.resolveTicket = async function() {
        if (!currentAdminTicketId) return;
        if (confirm("Mark this ticket as resolved?")) {
            try {
                const response = await fetch(`${API_BASE}/admin/tickets/${currentAdminTicketId}/status`, {
                    method: "PUT", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "Resolved" })
                });
                if (response.ok) {
                    openAdminChatThread(currentAdminTicketId); 
                    fetchAllTickets(); 
                }
            } catch (error) { console.error("Error resolving ticket:", error); }
        }
    }

    window.closeAdminModal = function() { 
        document.getElementById("adminChatModal").style.display = "none"; 
        currentAdminTicketId = null;
    }
});