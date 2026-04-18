document.addEventListener('DOMContentLoaded', () => {
    // 1. Scoped Variables (Protected from common.js conflicts)
    const API_BASE = 'http://localhost:5000/api';
    const consumerId = localStorage.getItem('consumerId');
    let currentOpenTicketId = null;

    // Security Check
    if (!consumerId) {
        alert("Please log in first.");
        window.location.href = "login-consumer.html";
        return;
    }

    // Automatically load tickets on page load
    fetchMyTickets();

    // --- Core Functions ---
    async function fetchMyTickets() {
        try {
            const response = await fetch(`${API_BASE}/consumer/${consumerId}/tickets`);
            const tickets = await response.json();
            
            const tbody = document.getElementById("ticketsTableBody");
            if (!tbody) return;
            tbody.innerHTML = ""; 

            if (tickets.length === 0) {
                tbody.innerHTML = "<tr><td colspan='5' style='text-align: center;'>No support tickets found.</td></tr>";
                return;
            }

            tickets.forEach(t => {
                let badgeClass = 'badge-gray';
                if (t.status === 'Open') badgeClass = 'badge-red';
                else if (t.status === 'In Progress') badgeClass = 'badge-blue';
                else if (t.status === 'Resolved') badgeClass = 'badge-green';
                
                const row = `
                    <tr>
                        <td>#${t.ticket_id}</td>
                        <td>${t.subject}</td>
                        <td>${t.created_at}</td>
                        <td><span class="badge ${badgeClass}">${t.status}</span></td>
                        <td><button class="pay-btn-table" onclick="openChatThread(${t.ticket_id})">View / Reply</button></td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        } catch (error) {
            console.error("Error fetching tickets:", error);
        }
    }

    // --- Window-Attached Functions (Required for HTML onclicks) ---
    window.submitTicket = async function() {
        const subject = document.getElementById("ticketSubject").value.trim();
        const message = document.getElementById("ticketMessage").value.trim();

        if (!subject || !message) {
            alert("Please provide both a subject and a message.");
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/consumer/${consumerId}/tickets`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subject, message })
            });

            const result = await response.json();
            if (response.ok) {
                alert(result.message);
                closeModal('newTicketModal');
                document.getElementById("ticketSubject").value = "";
                document.getElementById("ticketMessage").value = "";
                fetchMyTickets(); // Refresh table
            } else {
                alert(result.error);
            }
        } catch (error) {
            console.error("Error submitting ticket:", error);
        }
    }

    window.openChatThread = async function(ticketId) {
        currentOpenTicketId = ticketId;
        document.getElementById("chatModal").style.display = "block";
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
                
                // Auto-scroll to bottom of chat
                chatBox.scrollTop = chatBox.scrollHeight;
            }
        } catch (error) {
            console.error("Error fetching thread:", error);
        }
    }

    window.sendReply = async function() {
        const message = document.getElementById("replyMessage").value.trim();
        if (!message || !currentOpenTicketId) return;

        try {
            const response = await fetch(`${API_BASE}/tickets/${currentOpenTicketId}/reply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ senderRole: "consumer", message: message })
            });

            if (response.ok) {
                document.getElementById("replyMessage").value = ""; 
                openChatThread(currentOpenTicketId); // Refresh modal to show new message
                fetchMyTickets(); // Refresh background table 
            }
        } catch (error) {
            console.error("Error sending reply:", error);
        }
    }

    // Modal Display Controls
    window.openNewTicketModal = function() { 
        document.getElementById("newTicketModal").style.display = "block"; 
    }
    window.closeModal = function(id) { 
        document.getElementById(id).style.display = "none"; 
    }
});