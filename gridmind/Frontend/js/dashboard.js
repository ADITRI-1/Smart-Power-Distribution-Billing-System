// js/dashboard.js
document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';
    
    // 1. Fetch Dashboard Stats (Top numbers)
    fetch(`${API_BASE}/admin/dashboard`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('dash-grids').innerText = data.total_grids;
            document.getElementById('dash-areas').innerText = data.total_areas;
            document.getElementById('dash-consumers').innerText = data.total_consumers;
            document.getElementById('dash-conns').innerText = data.total_connections;
            
            // Format units supplied nicely with commas
            document.getElementById('dash-units').innerText = parseFloat(data.total_units_supplied).toLocaleString();
        })
        .catch(e => console.error("Error fetching stats:", e));

    // 2. Fetch Analytics for the Dashboard Charts
    fetch(`${API_BASE}/analytics`)
        .then(res => res.json())
        .then(data => {
            drawDashCharts(data.power_loss);
        })
        .catch(e => console.error("Error fetching analytics:", e));
});

// Function to draw charts specifically for the Dashboard canvases
function drawDashCharts(powerLossData) {
    if (!powerLossData || powerLossData.length === 0) return;
    
    const zones = powerLossData.map(item => item.zone); 
    const consumedData = powerLossData.map(item => parseFloat(item.units_consumed)); 
    const suppliedData = powerLossData.map(item => parseFloat(item.units_supplied));
    
    // Pie Chart
    const pieCtx = document.getElementById('dashPieChart').getContext('2d');
    new Chart(pieCtx, { 
        type: 'pie', 
        data: { 
            labels: zones, 
            datasets: [{ data: consumedData, backgroundColor: ['#2563EB', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6'], borderWidth: 1 }] 
        }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } } 
    });
    
    // Bar Chart
    const barCtx = document.getElementById('dashBarChart').getContext('2d');
    new Chart(barCtx, { 
        type: 'bar', 
        data: { 
            labels: zones, 
            datasets: [ 
                { label: 'Supplied', data: suppliedData, backgroundColor: '#2563EB' }, 
                { label: 'Consumed', data: consumedData, backgroundColor: '#10B981' } 
            ] 
        }, 
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } 
    });
}