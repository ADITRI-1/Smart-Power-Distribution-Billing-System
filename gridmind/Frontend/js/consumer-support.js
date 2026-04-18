document.addEventListener('DOMContentLoaded', () => {
    const consumerId = localStorage.getItem('consumerId');
    let currentOpenTicketId = null;

    if (!consumerId) {
        window.location.href = "login-consumer.html";
        return;
    }

    fetchMyTickets();

    async function fetchMyTickets() {
        try {
            const response = await fetch(`${API_BASE}/consumer/${consumerId}/tickets`);
            const tickets = await response.json();
            const tbody = document.getElementById("ticketsTableBody");
            if (!tbody) return;
            tbody.innerHTML = ""; 

            if (tickets.length === 0) return tbody.innerHTML = "<tr><td colspan='5' style='text-align: center;'>No support tickets found.</td></tr>";

            tickets.forEach(t => {
                let badgeClass = t.status === 'Open' ? 'badge-red' : (t.status === 'In Progress' ? 'badge-blue' : 'badge-green');
                
                // BEAUTIFUL THREAD BUTTON
                const viewBtn = `<button class="btn-action btn-thread" onclick="openChatThread(${t.ticket_id})">View / Reply</button>`;
                
                tbody.innerHTML += `
                    <tr>
                        <td>#${t.ticket_id}</td>
                        <td>${t.subject}</td>
                        <td>${t.created_at}</td>
                        <td><span class="badge ${badgeClass}">${t.status}</span></td>
                        <td class="action-icons">${viewBtn}</td>
                    </tr>
                `;
            });
        } catch (error) { console.error("Error fetching tickets:", error); }
    }

    window.submitTicket = async function() {
        const subject = document.getElementById("ticketSubject").value.trim();
        const message = document.getElementById("ticketMessage").value.trim();
        if (!subject || !message) return alert("Please provide both a subject and a message.");

        try {
            const response = await fetch(`${API_BASE}/consumer/${consumerId}/tickets`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subject, message })
            });
            const result = await response.json();
            if (response.ok) {
                alert(result.message);
                closeModal('newTicketModal');
                document.getElementById("ticketSubject").value = "";
                document.getElementById("ticketMessage").value = "";
                fetchMyTickets(); 
            } else alert(result.error);
        } catch (error) { console.error("Error:", error); }
    }

    window.openChatThread = async function(ticketId) {
        currentOpenTicketId = ticketId;
        document.getElementById("chatModal").style.display = "flex"; 
        document.getElementById("chatBox").innerHTML = "Loading messages...";

        try {
            const response = await fetch(`${API_BASE}/tickets/${ticketId}/replies`);
            const data = await response.json();

            if (response.ok) {
                document.getElementById("chatSubject").innerText = `Ticket #${data.ticket.ticket_id}: ${data.ticket.subject}`;
                document.getElementById("chatStatus").innerText = data.ticket.status;
                
                const chatBox = document.getElementById("chatBox");
                chatBox.innerHTML = "";

                data.replies.forEach(reply => {
                    const isConsumer = reply.sender_role === 'consumer';
                    const msgClass = isConsumer ? 'msg-consumer' : 'msg-admin';
                    const senderName = isConsumer ? "You" : "Support Admin";
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

    window.sendReply = async function() {
        const message = document.getElementById("replyMessage").value.trim();
        if (!message || !currentOpenTicketId) return;

        try {
            const response = await fetch(`${API_BASE}/tickets/${currentOpenTicketId}/reply`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ senderRole: "consumer", message: message })
            });
            if (response.ok) {
                document.getElementById("replyMessage").value = ""; 
                openChatThread(currentOpenTicketId); 
                fetchMyTickets(); 
            }
        } catch (error) { console.error("Error sending reply:", error); }
    }

    window.openNewTicketModal = function() { document.getElementById("newTicketModal").style.display = "flex"; }
});