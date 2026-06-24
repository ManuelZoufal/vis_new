let currentGroupId = null;
let groups = [];
let sensors = [];

async function fetchGroupData() {
    const response = await fetch('/api/get_data');
    const data = await response.json();

    groups = data.groups;
    sensors = data.sensors;
    const groupList = document.getElementById('group-list');
    groupList.innerHTML = '';
    data.groups.sort((a, b) => a.group_id.localeCompare(b.group_id)).forEach(group => {
        const currentOccupancy = calculateCurrentOccupancy(group.group_id, data.sensors);
        const occupancyPercentage = calculateOccupancyPercentage(currentOccupancy, group.max_occupancy);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${group.group_id}</td>
            <td>${group.name}</td>
            <td>${group.max_occupancy}</td>
            <td>${currentOccupancy}</td>
            <td>${occupancyPercentage}%</td>
            <td>${group.welcome_text}</td>
            <td>
                <label class="switch">
                    <input type="checkbox" ${group.maintenance_mode ? 'checked' : ''} onclick="toggleMaintenanceMode('${group.group_id}', this.checked)">
                    <span class="slider round"></span>
                </label>
            </td>
            <td>
                <button class="button button-secondary" onclick="openGroupModal('${group.group_id}')">Bearbeiten</button>
                <button class="button button-danger" onclick="confirmDeleteGroup('${group.group_id}')">Löschen</button>
            </td>
        `;
        groupList.appendChild(tr);
    });
}

function calculateCurrentOccupancy(groupId, sensors) {
    return sensors.filter(sensor => sensor.group_id === groupId).reduce((sum, sensor) => sum + sensor.occupancy, 0);
}

function calculateOccupancyPercentage(currentOccupancy, maxOccupancy) {
    return maxOccupancy > 0 ? ((currentOccupancy / maxOccupancy) * 100).toFixed(2) : 0;
}

function openGroupModal(groupId = null) {
    currentGroupId = groupId;
    const form = document.getElementById('groupForm');
    form.reset();
    if (groupId) {
        const group = groups.find(g => g.group_id === groupId);
        document.getElementById('groupModalTitle').innerText = `Gruppen Einstellungen für Gruppe ${group.name}`;
        document.getElementById('groupId').value = group.group_id;
        document.getElementById('groupName').value = group.name;
        document.getElementById('groupMaxOccupancy').value = group.max_occupancy;
        document.getElementById('groupWelcomeText').value = group.welcome_text;
        document.getElementById('groupMaintenanceMode').checked = group.maintenance_mode;
    } else {
        document.getElementById('groupModalTitle').innerText = 'Neue Gruppe hinzufügen';
    }
    document.getElementById('groupModal').style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

async function saveGroupSettings() {
    const form = document.getElementById('groupForm');
    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });
    data.maintenance_mode = document.getElementById('groupMaintenanceMode').checked;
    const url = currentGroupId ? `/api/groups/${currentGroupId}/edit` : '/api/groups/add';
    const method = currentGroupId ? 'POST' : 'PUT';
    const response = await fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    if (response.ok) {
        alert('Gruppe erfolgreich gespeichert');
        fetchGroupData();
        closeModal('groupModal');
    } else {
        alert('Fehler beim Speichern der Gruppe');
    }
}

async function deleteGroup(groupId) {
    const response = await fetch(`/api/groups/${groupId}/delete`, {
        method: 'DELETE'
    });
    if (response.ok) {
        alert('Gruppe erfolgreich gelöscht');
        fetchGroupData();
    } else {
        alert('Fehler beim Löschen der Gruppe');
    }
}

async function confirmDeleteGroup(groupId) {
    const associatedSensors = sensors.filter(sensor => sensor.group_id === groupId);
    if (associatedSensors.length > 0) {
        if (confirm('Dieser Gruppe sind noch Sensoren zugeordnet. Sind Sie sicher, dass Sie die Gruppe löschen möchten?')) {
            deleteGroup(groupId);
        }
    } else {
        if (confirm('Sind Sie sicher, dass Sie die Gruppe löschen möchten?')) {
            deleteGroup(groupId);
        }
    }
}

async function toggleMaintenanceMode(groupId, isChecked) {
    const response = await fetch(`/api/groups/${groupId}/toggle_maintenance_mode`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ maintenance_mode: isChecked })
    });
    if (response.ok) {
        alert('Wartungsmodus erfolgreich geändert');
        fetchGroupData();
    } else {
        alert('Fehler beim Ändern des Wartungsmodus');
    }
}

fetchGroupData();
setInterval(fetchGroupData, 1000);  // Refresh data every second

// Close the modal when clicking outside of it
window.onclick = function(event) {
    const groupModal = document.getElementById('groupModal');
    if (event.target === groupModal) {
        groupModal.style.display = 'none';
    }
}
