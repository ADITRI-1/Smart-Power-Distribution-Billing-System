// js/analytics.js
document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'http://localhost:5000/api';
    
    fetch(`${API_BASE}/analytics`)
        .then(res => res.json())
        .then(data => {
            const topAreasTbody = document.querySelector('#top-areas-table tbody');
            const powerLossTbody = document.querySelector('#power-loss-table tbody');
            
            topAreasTbody.innerHTML = ''; 
            data.top_areas.forEach(row => topAreasTbody.innerHTML += `<tr><td>${row.zone}</td><td>${row.total_units}</td></tr>`);
            
            powerLossTbody.innerHTML = ''; 
            data.power_loss.forEach(row => powerLossTbody.innerHTML += `<tr><td>${row.zone}</td><td>${row.city}</td><td>${row.units_supplied}</td><td>${row.units_consumed}</td><td class="text-red">${row.power_loss} units</td></tr>`);
            
            drawCharts(data.power_loss);
        });
});

function drawCharts(powerLossData) {
    if (!powerLossData || powerLossData.length === 0) return;
    const zones = powerLossData.map(item => item.zone); 
    const consumedData = powerLossData.map(item => parseFloat(item.units_consumed)); 
    const suppliedData = powerLossData.map(item => parseFloat(item.units_supplied));
    
    const pieCtx = document.getElementById('consumptionPieChart').getContext('2d');
    new Chart(pieCtx, { type: 'pie', data: { labels: zones, datasets: [{ data: consumedData, backgroundColor: ['#2563EB', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6'], borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } } });
    
    const barCtx = document.getElementById('supplyBarChart').getContext('2d');
    new Chart(barCtx, { type: 'bar', data: { labels: zones, datasets: [ { label: 'Supplied', data: suppliedData, backgroundColor: '#2563EB', }, { label: 'Consumed', data: consumedData, backgroundColor: '#10B981', } ] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } });
}