async function fetchOccupancy(groupId) {
    try {
        const response = await fetch(`/api/get_data`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        const group = data.groups.find(g => g.group_id === groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        const total_occupancy = data.sensors
            .filter(sensor => sensor.group_id === groupId)
            .reduce((sum, sensor) => sum + sensor.occupancy, 0);
        return {
            total_occupancy,
            max_occupancy: group.max_occupancy,
            welcome_text: group.welcome_text,
            maintenance_mode: group.maintenance_mode
        };
    } catch (error) {
        console.error('Fetch occupancy failed:', error);
        activateMaintenanceMode();
        throw error;
    }
}

function activateMaintenanceMode() {
    document.getElementById('visualization-section').style.display = 'none';
    document.getElementById('maintenance-section').style.display = 'block';
}

function deactivateMaintenanceMode() {
    document.getElementById('visualization-section').style.display = 'block';
    document.getElementById('maintenance-section').style.display = 'none';
}

function updateChart(chart, data) {
    const maintenanceSection = document.getElementById('maintenance-section');
    const visualizationSection = document.getElementById('visualization-section');
    const greeting = document.getElementById('greeting');

    if (data.maintenance_mode) {
        maintenanceSection.style.display = 'flex';
        visualizationSection.style.display = 'none';
    } else {
        maintenanceSection.style.display = 'none';
        visualizationSection.style.display = 'flex';
        greeting.innerText = data.welcome_text;

        chart.data.datasets[0].data = [Math.max(0, data.total_occupancy), Math.max(0, data.max_occupancy - data.total_occupancy)];
        chart.update();
        const percentage = Math.max(0, Math.round((data.total_occupancy / data.max_occupancy) * 100));
        const percentageElement = document.getElementById('percentage');
        percentageElement.innerText = `${percentage}%`;
        if (data.total_occupancy >= data.max_occupancy) {
            percentageElement.style.color = 'red';
        } else {
            percentageElement.style.color = 'green';
        }
    }
}

function updateTrafficLight(totalOccupancy, maxOccupancy) {
    const redLight = document.querySelector('.light.red');
    const greenLight = document.querySelector('.light.green');
    const statusText = document.getElementById('statusText');
    if (totalOccupancy >= maxOccupancy) {
        redLight.classList.add('active');
        greenLight.classList.remove('active');
        statusText.innerText = 'Bitte warten Sie!';
        statusText.style.color = 'red';
    } else {
        redLight.classList.remove('active');
        greenLight.classList.add('active');
        statusText.innerText = 'Bitte treten Sie ein!';
        statusText.style.color = 'green';
    }
}

function updateMarqueeText() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '{{ url_for("visualize.get_marquee_text") }}', true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
            var response = JSON.parse(xhr.responseText);
            document.getElementById('marquee-text').innerText = response.marquee_text;
        }
    };
    xhr.send();
}


async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const groupId = urlParams.get('group_id') || '1';  // Default group_id is '1'
    try {
        const data = await fetchOccupancy(groupId);
        deactivateMaintenanceMode();

        const centerTextPlugin = {
            id: 'centerText',
            afterDraw(chart) {
                const { ctx, chartArea: { left, top, width, height } } = chart;
                const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                const value = chart.data.datasets[0].data[0];
                const pct = total > 0 ? Math.round(value / total * 100) : 0;
                ctx.save();
                ctx.font = 'bold 2.5em Arial';
                ctx.fillStyle = pct >= 100 ? '#ff2020' : '#009999';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${pct}%`, left + width / 2, top + height / 2);
                ctx.restore();
            }
        };

        const ctx = document.getElementById('occupancyChart').getContext('2d');
        const occupancyChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Belegt', 'Verfügbar'],
                datasets: [{
                    data: [Math.max(0, data.total_occupancy), Math.max(0, data.max_occupancy - data.total_occupancy)],
                    backgroundColor: ['#FF2020', '#00CC00'],
                    hoverBackgroundColor: ['#FF5555', '#00AA00']
                }]
            },
            options: {
                cutout: '70%',
                plugins: {
                    datalabels: { display: false },
                    legend: { display: false }
                }
            },
            plugins: [centerTextPlugin]
        });

        updateChart(occupancyChart, data);
        updateTrafficLight(data.total_occupancy, data.max_occupancy);
        setInterval(updateMarqueeText, 5000); // Aktualisiere alle 5 Sekunden

        setInterval(async () => {
            try {
                const newData = await fetchOccupancy(groupId);
                deactivateMaintenanceMode();
                updateChart(occupancyChart, newData);
                updateTrafficLight(newData.total_occupancy, newData.max_occupancy);
            } catch (error) {
                console.error('Error updating data:', error);
            }
        }, 1000);
    } catch (error) {
        console.error('Initialization failed:', error);
    }
}


init();
