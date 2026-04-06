document.addEventListener('DOMContentLoaded', () => {
    fetch(`${API_BASE}/analytics`).then(res => res.json()).then(data => {
        const topAreasTbody = document.querySelector('#top-areas-table tbody'), powerLossTbody = document.querySelector('#power-loss-table tbody');
        topAreasTbody.innerHTML = ''; data.top_areas.forEach(r => topAreasTbody.innerHTML += `<tr><td>${r.zone}</td><td>${r.total_units}</td></tr>`);
        powerLossTbody.innerHTML = ''; data.power_loss.forEach(r => powerLossTbody.innerHTML += `<tr><td>${r.zone}</td><td>${r.city}</td><td>${r.units_supplied}</td><td>${r.units_consumed}</td><td class="text-red">${r.power_loss}</td></tr>`);
        if (!data.power_loss || data.power_loss.length === 0) return;
        const zones = data.power_loss.map(i => i.zone), consumedData = data.power_loss.map(i => parseFloat(i.units_consumed)), suppliedData = data.power_loss.map(i => parseFloat(i.units_supplied));
        new Chart(document.getElementById('consumptionPieChart').getContext('2d'), { type: 'pie', data: { labels: zones, datasets: [{ data: consumedData, backgroundColor: ['#2563EB', '#F59E0B', '#10B981'], borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } } });
        new Chart(document.getElementById('supplyBarChart').getContext('2d'), { type: 'bar', data: { labels: zones, datasets: [ { label: 'Supplied', data: suppliedData, backgroundColor: '#2563EB' }, { label: 'Consumed', data: consumedData, backgroundColor: '#10B981' } ] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } });
    });
});