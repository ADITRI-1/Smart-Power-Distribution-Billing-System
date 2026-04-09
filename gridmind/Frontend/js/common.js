const API_BASE = 'http://localhost:5000/api';

window.deleteRecord = async function(tableName, recordId) {
    if(confirm(`Are you sure you want to delete record ID ${recordId} from ${tableName}?`)) {
        try { 
            const res = await fetch(`${API_BASE}/delete/${tableName}/${recordId}`, { method: 'DELETE' }); 
            const data = await res.json();
            if(res.ok) window.location.reload(); else alert(data.error || "Cannot delete."); 
        } catch(e) { alert("Server error."); }
    }
};

const getDeleteBtn = (table, id) => `<span class="action-delete" onclick="deleteRecord('${table}', ${id})" title="Delete">🗑️</span>`;

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.remove();
};

// Global Logout Function
window.logout = function() {
    // 1. Clear the saved session data (like the consumerId)
    localStorage.clear();
    
    // 2. Kick the user back to the login screen
    window.location.replace('login-consumer.html'); 
};

// ==========================================
// UNIVERSAL PDF INVOICE GENERATOR
// ==========================================
window.downloadInvoice = async function(billId) {
    const btn = event.currentTarget; // Get the button that was clicked
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ Generating...";
    btn.disabled = true;

    try {
        // 1. Fetch the massive data payload from Python
        const res = await fetch(`http://localhost:5000/api/bills/${billId}/invoice`);
        const data = await res.json();
        if(!res.ok) throw new Error(data.error);

        // 2. Build the Official Invoice Template
        const invoiceHtml = `
            <div id="invoice-box" style="padding: 40px; font-family: 'Segoe UI', Arial, sans-serif; color: #333; width: 800px; background: white; margin: 0 auto;">
                
                <div style="display: flex; justify-content: space-between; border-bottom: 3px solid #2563EB; padding-bottom: 20px; margin-bottom: 30px;">
                    <div>
                        <h1 style="color: #2563EB; margin: 0; font-size: 32px; font-weight: 800;">⚡ Smart Power</h1>
                        <p style="margin: 5px 0 0 0; color: #6B7280; font-size: 14px;">Official Electricity Invoice</p>
                    </div>
                    <div style="text-align: right;">
                        <h2 style="margin: 0; color: #111827; font-size: 24px;">INVOICE #${data.bill_id}</h2>
                        <div style="display: inline-block; padding: 4px 12px; margin-top: 8px; border-radius: 4px; font-weight: bold; background-color: ${data.payment_status === 'Paid' ? '#D1FAE5' : '#FEE2E2'}; color: ${data.payment_status === 'Paid' ? '#065F46' : '#991B1B'};">
                            STATUS: ${data.payment_status.toUpperCase()}
                        </div>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 40px; line-height: 1.6;">
                    <div style="width: 48%; background: #F9FAFB; padding: 15px; border-radius: 8px;">
                        <h3 style="border-bottom: 1px solid #E5E7EB; padding-bottom: 8px; color: #4B5563; margin-top: 0; font-size: 14px; text-transform: uppercase;">Billed To</h3>
                        <p style="margin: 5px 0; font-size: 16px; font-weight: bold; color: #111827;">${data.consumer_name}</p>
                        <p style="margin: 5px 0; color: #4B5563; font-size: 14px;">Consumer ID: #${data.consumer_id}</p>
                        <p style="margin: 5px 0; color: #4B5563; font-size: 14px;">${data.permanent_address}</p>
                    </div>
                    <div style="width: 48%; background: #F9FAFB; padding: 15px; border-radius: 8px;">
                        <h3 style="border-bottom: 1px solid #E5E7EB; padding-bottom: 8px; color: #4B5563; margin-top: 0; font-size: 14px; text-transform: uppercase;">Connection Details</h3>
                        <p style="margin: 5px 0; color: #4B5563; font-size: 14px;"><strong>Meter ID:</strong> #${data.connection_id} (${data.connection_type}, ${data.load_assign})</p>
                        <p style="margin: 5px 0; color: #4B5563; font-size: 14px;"><strong>Location:</strong> ${data.connection_address}</p>
                        <p style="margin: 5px 0; color: #4B5563; font-size: 14px;"><strong>Power Source:</strong> ${data.grid_name} (${data.zone}, ${data.city})</p>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
                    <thead>
                        <tr style="background-color: #2563EB; color: white; text-align: left;">
                            <th style="padding: 12px 15px; border-radius: 6px 0 0 0;">Billing Month</th>
                            <th style="padding: 12px 15px;">Units Consumed</th>
                            <th style="padding: 12px 15px;">Tariff Rate</th>
                            <th style="padding: 12px 15px;">Fixed Charges</th>
                            <th style="padding: 12px 15px; text-align: right; border-radius: 0 6px 0 0;">Total Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom: 2px solid #E5E7EB;">
                            <td style="padding: 15px; color: #111827; font-weight: 500;">${data.billing_month}</td>
                            <td style="padding: 15px; color: #4B5563;">${data.units_consumed} kWh</td>
                            <td style="padding: 15px; color: #4B5563;">₹${data.rate_per_unit} / kWh</td>
                            <td style="padding: 15px; color: #4B5563;">₹${data.fixed_charge}</td>
                            <td style="padding: 15px; text-align: right; font-weight: bold; font-size: 18px; color: #111827;">₹${parseFloat(data.amount).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                        </tr>
                    </tbody>
                </table>

                <div style="display: flex; justify-content: space-between; border-top: 1px solid #E5E7EB; padding-top: 20px;">
                    <div style="line-height: 1.8;">
                        <p style="margin: 0; color: #4B5563; font-size: 14px;"><strong>Generated On:</strong> ${data.generated_on}</p>
                        <p style="margin: 0; color: #DC2626; font-size: 14px;"><strong>Due Date:</strong> ${data.due_date}</p>
                    </div>
                    <div style="text-align: right; line-height: 1.8;">
                        ${data.payment_status === 'Paid' ? `
                            <p style="margin: 0; color: #059669; font-size: 14px;"><strong>Paid On:</strong> ${data.paid_on}</p>
                            <p style="margin: 0; color: #4B5563; font-size: 14px;"><strong>Method:</strong> ${data.payment_method || 'Online Transaction'}</p>
                        ` : `
                            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #DC2626;">AMOUNT DUE: ₹${parseFloat(data.amount).toLocaleString(undefined,{minimumFractionDigits:2})}</p>
                        `}
                    </div>
                </div>

                <div style="margin-top: 60px; text-align: center; border-top: 1px dashed #E5E7EB; padding-top: 20px;">
                    <p style="color: #9CA3AF; font-size: 12px; margin: 0;">This is a system-generated invoice and does not require a physical signature.</p>
                    <p style="color: #9CA3AF; font-size: 12px; margin: 5px 0 0 0;">For support, contact Smart Power Administration.</p>
                </div>
            </div>
        `;

        // 3. Create a temporary, hidden container on the webpage
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = invoiceHtml;
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px'; // Hide it off-screen
        document.body.appendChild(tempDiv);

        // 4. Trigger the PDF Generation
        const element = document.getElementById('invoice-box');
        const opt = {
            margin:       0.5,
            filename:     `SmartPower_Invoice_${billId}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        await html2pdf().set(opt).from(element).save();
        
        // 5. Clean up the hidden HTML
        document.body.removeChild(tempDiv);

    } catch(e) {
        console.error(e);
        alert("Error generating invoice. Check console.");
    } finally {
        // Restore the button
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};