// Base API URL
const API_BASE = 'http://localhost:5000/api';

// Safely get the logged-in consumer's ID from localStorage (set during login)
const consumerId = localStorage.getItem('consumerId');
let currentOpenTicketId = null; // Tracks which thread is currently open

// Redirect if not logged in
if (!consumerId) {
    alert("Please log in first.");
    window.location.href = "login-consumer.html";
}

// Automatically load tickets when the page opens
document.addEventListener("DOMContentLoaded", fetchMyTickets);

// --- 1. Fetch & Display Tickets ---
async function fetchMyTickets() {
    try {
        const response = await fetch(`${API_BASE}/consumer/${consumerId}/tickets`);
        const tickets = await response.json();
        
        const tbody = document.getElementById("ticketsTableBody");
        tbody.innerHTML = ""; // Clear existing rows

        if (tickets.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' style='text-align: center;'>No support tickets found.</td></tr>";
            return;
        }

        tickets.forEach(t => {
            // Map statuses to standard UI badges
            let badgeClass = 'badge-gray';
            const statusLower = t.status.toLowerCase();
            if (statusLower === 'open') badgeClass = 'badge-red';
            else if (statusLower === 'in progress') badgeClass = 'badge-warning';
            else if (statusLower === 'resolved') badgeClass = 'badge-success';
            
            const row = `
                <tr>
                    <td>#${t.ticket_id}</td>
                    <td>${t.subject}</td>
                    <td>${t.created_at}</td>
                    <td><span class="badge ${badgeClass}">${t.status}</span></td>
                    <td><button class="btn-view" onclick="openChatThread(${t.ticket_id})">View / Reply</button></td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch (error) {
        console.error("Error fetching tickets:", error);
    }
}

// --- 2. Create a New Ticket ---
async function submitTicket() {
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
            fetchMyTickets(); // Refresh the table
        } else {
            alert(result.error);
        }
    } catch (error) {
        console.error("Error submitting ticket:", error);
    }
}

// --- 3. Open & Load Chat Thread ---
async function openChatThread(ticketId) {
    currentOpenTicketId = ticketId;
    document.getElementById("chatModal").style.display = "block";
    document.getElementById("chatBox").innerHTML = "Loading messages...";

    try {
        const response = await fetch(`${API_BASE}/tickets/${ticketId}/replies`);
        const data = await response.json();

        if (response.ok) {
            document.getElementById("chatSubject").innerText = `Ticket #${data.ticket.ticket_id}: ${data.ticket.subject}`;
            
            const statusSpan = document.getElementById("chatStatus");
            statusSpan.innerText = data.ticket.status;
            statusSpan.className = "badge"; // Reset classes
            
            const statusLower = data.ticket.status.toLowerCase();
            if (statusLower === 'open') statusSpan.classList.add('badge-red');
            else if (statusLower === 'in progress') statusSpan.classList.add('badge-warning');
            else if (statusLower === 'resolved') statusSpan.classList.add('badge-success');
            
            // 👇 THIS WAS MISSING: Grab the chat box and clear the "Loading..." text
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
            
            // Scroll to bottom of chat
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    } catch (error) {
        console.error("Error fetching thread:", error);
        document.getElementById("chatBox").innerHTML = "Failed to load messages.";
    }
}

// --- 4. Send a Reply ---
async function sendReply() {
    const message = document.getElementById("replyMessage").value.trim();
    if (!message || !currentOpenTicketId) return;

    try {
        const response = await fetch(`${API_BASE}/tickets/${currentOpenTicketId}/reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ senderRole: "consumer", message: message })
        });

        if (response.ok) {
            document.getElementById("replyMessage").value = ""; // Clear input
            openChatThread(currentOpenTicketId); // Reload thread to show new message
            fetchMyTickets(); // Refresh background table (status might have changed to 'Open')
        }
    } catch (error) {
        console.error("Error sending reply:", error);
    }
}

// --- Utility Functions ---
function openNewTicketModal() { document.getElementById("newTicketModal").style.display = "block"; }
function closeModal(id) { document.getElementById(id).style.display = "none"; }
function logout() {
    localStorage.removeItem('consumerId');
    window.location.href = "login-consumer.html";
}