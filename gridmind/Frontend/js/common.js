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
// UNIVERSAL PDF INVOICE GENERATOR (100% FIXED)
// ==========================================
window.downloadInvoice = async function(billId) {
    const btn = event.currentTarget || document.activeElement;
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ Generating...";
    btn.disabled = true;

    try {
        // 1. Backend se data fetch karna
        const res = await fetch(`http://localhost:5000/api/bills/${billId}/invoice`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch data");

        // Calculations safely format karna
        const energyCharge = parseFloat(data.units_consumed) * parseFloat(data.rate_per_unit);
        const fixedCharge = parseFloat(data.fixed_charge);
        const totalAmount = parseFloat(data.amount);
        const prevReading = data.previous_reading !== null ? data.previous_reading : '-';
        const currReading = data.current_reading !== null ? data.current_reading : '-';
        const isPaid = data.payment_status === 'Paid';

        // 2. Perfect Table-Based HTML Layout (Isme overlap nahi hoga)
        const invoiceHtml = `
        <div id="pdf-content" style="width: 800px; padding: 40px; background: white; font-family: Arial, sans-serif; color: #333; box-sizing: border-box;">
            
            <table width="100%" style="border-bottom: 2px solid #2563EB; padding-bottom: 10px; margin-bottom: 30px; border-collapse: collapse;">
                <tr>
                    <td style="vertical-align: bottom;">
                        <h1 style="color: #2563EB; font-size: 36px; margin: 0;">⚡ Smart Power</h1>
                        <p style="color: #777; font-size: 14px; margin: 5px 0 0 0;">Official Electricity Invoice</p>
                    </td>
                    <td style="text-align: right; vertical-align: bottom;">
                        <h2 style="font-size: 24px; margin: 0 0 10px 0; color: #111;">INVOICE #${data.bill_id}</h2>
                        <span style="background-color: ${isPaid ? '#D1FAE5' : '#FEE2E2'}; color: ${isPaid ? '#065F46' : '#991B1B'}; padding: 6px 12px; font-weight: bold; border-radius: 4px; font-size: 14px;">
                            STATUS: ${data.payment_status.toUpperCase()}
                        </span>
                    </td>
                </tr>
            </table>

            <table width="100%" style="margin-bottom: 30px; border-collapse: collapse;">
                <tr>
                    <td width="48%" style="background: #F9FAFB; padding: 20px; border-radius: 8px; vertical-align: top;">
                        <h3 style="font-size: 14px; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top: 0;">BILLED TO</h3>
                        <p style="font-size: 18px; font-weight: bold; margin: 10px 0 5px 0; color: #111;">${data.consumer_name}</p>
                        <p style="font-size: 14px; color: #666; margin: 0 0 5px 0;">Consumer ID: #${data.consumer_id}</p>
                        <p style="font-size: 14px; color: #666; margin: 0;">${data.permanent_address}</p>
                    </td>
                    <td width="4%"></td> <td width="48%" style="background: #F9FAFB; padding: 20px; border-radius: 8px; vertical-align: top;">
                        <h3 style="font-size: 14px; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top: 0;">CONNECTION DETAILS</h3>
                        <p style="font-size: 14px; color: #666; margin: 10px 0 5px 0;"><strong>Meter ID:</strong> #${data.connection_id} (${data.connection_type}, ${data.load_assign})</p>
                        <p style="font-size: 14px; color: #666; margin: 0 0 5px 0;"><strong>Location:</strong> ${data.connection_address}</p>
                        <p style="font-size: 14px; color: #666; margin: 0;"><strong>Power Source:</strong> ${data.grid_name} (${data.zone}, ${data.city})</p>
                    </td>
                </tr>
            </table>

            <table width="100%" style="border-collapse: collapse; margin-bottom: 40px;">
                <thead>
                    <tr style="background: #2563EB; color: white;">
                        <th style="padding: 12px; text-align: left; border-radius: 4px 0 0 0;">Billing Month</th>
                        <th style="padding: 12px; text-align: left;">Units Consumed</th>
                        <th style="padding: 12px; text-align: left;">Tariff Rate</th>
                        <th style="padding: 12px; text-align: left;">Fixed Charges</th>
                        <th style="padding: 12px; text-align: right; border-radius: 0 4px 0 0;">Total Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding: 15px 12px; font-weight: bold; color: #111;">${data.billing_month}</td>
                        <td style="padding: 15px 12px; color: #555;">
                            ${data.units_consumed} kWh<br>
                            <span style="font-size:11px; color:#888;">(Prev: ${prevReading} | Curr: ${currReading})</span>
                        </td>
                        <td style="padding: 15px 12px; color: #555;">₹${data.rate_per_unit} / kWh</td>
                        <td style="padding: 15px 12px; color: #555;">₹${data.fixed_charge}</td>
                        <td style="padding: 15px 12px; text-align: right; font-weight: bold; font-size: 18px; color: #111;">₹${totalAmount.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                    </tr>
                </tbody>
            </table>

            <table width="100%" style="border-collapse: collapse;">
                <tr>
                    <td width="50%" style="vertical-align: top;">
                        <p style="margin: 0 0 5px 0; font-size: 14px; color: #555;"><strong>Generated On:</strong> ${data.generated_on}</p>
                        <p style="margin: 0; font-size: 14px; color: #DC2626;"><strong>Due Date:</strong> ${data.due_date}</p>
                    </td>
                    <td width="50%" style="text-align: right; vertical-align: top;">
                        ${isPaid ? 
                            `<p style="margin: 0 0 5px 0; font-size: 14px; color: #059669;"><strong>Paid On:</strong> ${data.paid_on}</p>
                             <p style="margin: 0; font-size: 14px; color: #555;"><strong>Method:</strong> ${data.payment_method || 'Online Transaction'}</p>`
                            : 
                            `<p style="margin: 0; font-size: 18px; font-weight: bold; color: #DC2626;">AMOUNT DUE: ₹${totalAmount.toLocaleString('en-IN', {minimumFractionDigits:2})}</p>`
                        }
                    </td>
                </tr>
            </table>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px dashed #ccc; text-align: center; font-size: 12px; color: #999;">
                This is a system-generated invoice and does not require a physical signature.<br>
                For support, contact Smart Power Administration.
            </div>
        </div>
        `;

        // 3. SAFE HIDDEN DIV: Ye sabse zaroori hissa hai PDF library ke bug se bachne ke liye
        const container = document.createElement('div');
        container.innerHTML = invoiceHtml;
        // Div ko screen ke upar rakhenge but poora transparent kar denge taaki library galti na kare
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = '0';
        container.style.opacity = '0'; 
        container.style.zIndex = '-9999';
        container.style.pointerEvents = 'none';
        document.body.appendChild(container);

        const element = document.getElementById('pdf-content');

        // 4. Engine Configuration (A4 Format)
        const opt = {
            margin:       0.3,
            filename:     `SmartPower_Invoice_${billId}.pdf`,
            image:        { type: 'jpeg', quality: 1 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        // 5. Download and Clean up
        await html2pdf().set(opt).from(element).save();
        document.body.removeChild(container);

    } catch (e) {
        console.error("PDF Gen Error:", e);
        alert("Error generating invoice. Ensure Backend is connected.");
    } finally {
        if(btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
};