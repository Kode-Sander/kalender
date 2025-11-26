// --- KONFIGURASJON ---
const API_URL = 'http://localhost:3000/api';
let startHour = 7;  // Endret fra const til let for settings
let endHour = 17;   // Endret fra const til let for settings
const hourHeight = 60;

// Globale variabler
let appointments = [];
let practitioners = [];
let currentWeekStart = getStartOfWeek(new Date());

// --- INITIALISERING ---
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initGrid();
    updateHeaderDates();
    fetchPractitioners();
    fetchAppointments();
    setupCurrentTime();
    setInterval(setupCurrentTime, 60000);
});

// --- HJELPEFUNKSJONER FOR DATO ---
function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0,0,0,0);
    return d;
}

function updateHeaderDates() {
    const headerCells = document.querySelectorAll('.header-cell .day-num');
    const dateRangeSpan = document.querySelector('.current-date-range');

    for (let i = 0; i < 7; i++) {
        const d = new Date(currentWeekStart);
        d.setDate(currentWeekStart.getDate() + i);

        if(headerCells[i]) headerCells[i].innerText = d.getDate();
    }

    const endOfWeek = new Date(currentWeekStart);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    dateRangeSpan.innerText = `${currentWeekStart.toLocaleDateString('no-NO')} - ${endOfWeek.toLocaleDateString('no-NO')}`;
}

function changeWeek(offset) {
    currentWeekStart.setDate(currentWeekStart.getDate() + (offset * 7));
    fetchAppointments();
    updateHeaderDates();
}

function goToToday() {
    currentWeekStart = getStartOfWeek(new Date());
    fetchAppointments();
    updateHeaderDates();
}

// --- API CALLS ---
async function fetchPractitioners() {
    try {
        const response = await fetch(`${API_URL}/practitioners`);
        practitioners = await response.json();

        // Populate main dropdown
        const select = document.getElementById('practitionerSelect');
        practitioners.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.name;
            select.appendChild(option);
        });

        // Populate appointment modal dropdown
        const modalSelect = document.getElementById('inputPractitioner');
        practitioners.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = `${p.name} (${p.role})`;
            modalSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Feil ved henting av behandlere:", error);
    }
}

async function fetchAppointments() {
    const startStr = currentWeekStart.toISOString();
    const endOfWeek = new Date(currentWeekStart);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    const endStr = endOfWeek.toISOString();

    // Get selected practitioner ID
    const practitionerId = document.getElementById('practitionerSelect')?.value || 'all';

    try {
        const response = await fetch(`${API_URL}/appointments?start=${startStr}&end=${endStr}&practitionerId=${practitionerId}`);
        const data = await response.json();

        appointments = data.map(appt => {
            const startDate = new Date(appt.start_time);
            const endDate = new Date(appt.end_time);

            let dayIndex = startDate.getDay() - 1;
            if (dayIndex === -1) dayIndex = 6;

            // Find practitioner name
            const practitioner = practitioners.find(p => p.id === appt.practitioner_id);

            return {
                id: appt.id,
                day: dayIndex,
                start: startDate.toLocaleTimeString('no-NO', {hour:'2-digit', minute:'2-digit'}),
                end: endDate.toLocaleTimeString('no-NO', {hour:'2-digit', minute:'2-digit'}),
                patient: appt.patient,
                type: appt.type,
                practitioner_id: appt.practitioner_id,
                practitioner_name: practitioner ? practitioner.name : 'Ukjent',
                fullDate: startDate
            };
        });

        renderEvents();
    } catch (error) {
        console.error("Feil ved henting:", error);
    }
}

async function saveAppointment() {
    const dayIndex = parseInt(document.getElementById('inputDayIndex').value);
    const dateForCol = new Date(currentWeekStart);
    dateForCol.setDate(dateForCol.getDate() + dayIndex);

    const startInput = document.getElementById('inputStart').value;
    const endInput = document.getElementById('inputEnd').value;
    const practitionerId = document.getElementById('inputPractitioner').value;

    // Validate practitioner selection
    if (!practitionerId) {
        alert("Vennligst velg en behandler!");
        return;
    }

    const [sH, sM] = startInput.split(':');
    const startDateTime = new Date(dateForCol);
    startDateTime.setHours(sH, sM, 0);

    const [eH, eM] = endInput.split(':');
    const endDateTime = new Date(dateForCol);
    endDateTime.setHours(eH, eM, 0);

    const payload = {
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        patient: document.getElementById('inputPatient').value,
        type: document.getElementById('inputType').value,
        practitioner_id: practitionerId
    };

    try {
        const response = await fetch(`${API_URL}/appointments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.status === 409) {
            alert("Denne tiden kolliderer med en annen avtale!");
            return;
        }

        if (response.ok) {
            fetchAppointments();
            closeModal();
        }
    } catch (error) {
        console.error("Feil ved lagring:", error);
        alert("Kunne ikke lagre avtalen. Er serveren kjørende?");
    }
}

async function deleteAppointment() {
    const id = document.getElementById('inputId').value;
    if (!id) return;

    try {
        const response = await fetch(`${API_URL}/appointments/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            fetchAppointments();
            closeModal();
        }
    } catch (error) {
        console.error("Feil ved sletting:", error);
    }
}

// --- GRID RENDERING ---
function initGrid() {
    const gridBody = document.getElementById('gridBody');
    const timeLabels = document.getElementById('timeLabels');

    for (let h = startHour; h <= endHour; h++) {
        const timeSlot = document.createElement('div');
        timeSlot.className = 'time-slot';
        timeSlot.innerText = h.toString().padStart(2,'0') + ":00";
        timeLabels.appendChild(timeSlot);
    }

    for (let d = 0; d < 7; d++) {
        const col = document.createElement('div');
        col.className = 'day-col';
        col.id = `day-${d}`;

        const workBg = document.createElement('div');
        workBg.className = 'working-hours-bg';
        workBg.style.top = (8 - startHour) * hourHeight + 'px';
        workBg.style.height = (8 * hourHeight) + 'px';
        col.appendChild(workBg);

        for (let h = startHour; h < endHour; h++) {
            const line = document.createElement('div');
            line.className = 'grid-line-horizontal';
            line.style.top = ((h - startHour) * hourHeight) + 'px';
            col.appendChild(line);
        }

        col.addEventListener('click', (e) => handleGridClick(e, d));

        gridBody.appendChild(col);
    }
}

function renderEvents() {
    document.querySelectorAll('.event-card').forEach(e => e.remove());

    appointments.forEach(appt => {
        const col = document.getElementById(`day-${appt.day}`);
        if(!col) return;

        const startMin = timeToMinutes(appt.start);
        const endMin = timeToMinutes(appt.end);
        const startOffset = startMin - (startHour * 60);
        const duration = endMin - startMin;

        const card = document.createElement('div');
        card.className = 'event-card';
        card.style.top = (startOffset / 60 * hourHeight) + 'px';
        card.style.height = (duration / 60 * hourHeight) + 'px';

        card.innerHTML = `
            <div class="event-time">${appt.start} - ${appt.end}</div>
            <div class="event-title">${appt.patient}</div>
            <div class="event-sub">${appt.practitioner_name || 'Ukjent'}</div>
        `;

        card.addEventListener('click', (e) => {
            e.stopPropagation();
            openModalForEdit(appt);
        });

        col.appendChild(card);
    });
}

// --- HJELPEFUNKSJONER ---
function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function minutesToTime(totalMin) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
}

function setupCurrentTime() {
    const oldLine = document.querySelector('.now-indicator');
    if(oldLine) oldLine.remove();

    const now = new Date();
    const currentDay = now.getDay() - 1;
    const adjustedDay = currentDay === -1 ? 6 : currentDay;

    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    if (currentHour < startHour || currentHour > endHour) return;

    const col = document.getElementById(`day-${adjustedDay}`);
    if (col) {
        const minutesFromStart = (currentHour - startHour) * 60 + currentMin;
        const topPx = (minutesFromStart / 60) * hourHeight;

        const line = document.createElement('div');
        line.className = 'now-indicator';
        line.style.top = topPx + 'px';
        line.innerHTML = '<div class="now-dot"></div>';
        col.appendChild(line);
    }
}

// --- MODAL LOGIKK ---
const modal = document.getElementById('appointmentModal');
const inputId = document.getElementById('inputId');
const inputPatient = document.getElementById('inputPatient');
const inputStart = document.getElementById('inputStart');
const inputEnd = document.getElementById('inputEnd');
const inputType = document.getElementById('inputType');
const inputDayIndex = document.getElementById('inputDayIndex');
const btnDelete = document.getElementById('btnDelete');
const modalTitle = document.getElementById('modalTitle');

function openModal() {
    modal.classList.add('open');
}

function closeModal() {
    modal.classList.remove('open');
}

function handleGridClick(e, dayIndex) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hoursFromStart = y / hourHeight;

    const clickedHour = startHour + Math.floor(hoursFromStart);
    const startTimeStr = `${clickedHour.toString().padStart(2,'0')}:00`;
    const endTimeStr = `${(clickedHour+1).toString().padStart(2,'0')}:00`;

    inputId.value = '';
    inputPatient.value = '';
    inputStart.value = startTimeStr;
    inputEnd.value = endTimeStr;
    inputDayIndex.value = dayIndex;
    inputType.selectedIndex = 0;

    // Set practitioner from filter or reset
    const selectedPractitioner = document.getElementById('practitionerSelect').value;
    const practitionerInput = document.getElementById('inputPractitioner');
    if (selectedPractitioner && selectedPractitioner !== 'all') {
        practitionerInput.value = selectedPractitioner;
    } else {
        practitionerInput.value = '';
    }

    btnDelete.style.display = 'none';
    modalTitle.innerText = "Ny avtale";

    openModal();
}

function openModalForEdit(appt) {
    inputId.value = appt.id;
    inputPatient.value = appt.patient;
    inputStart.value = appt.start;
    inputEnd.value = appt.end;
    inputDayIndex.value = appt.day;
    inputType.value = appt.type;
    document.getElementById('inputPractitioner').value = appt.practitioner_id || '';

    btnDelete.style.display = 'block';
    modalTitle.innerText = "Rediger avtale";

    openModal();
}

modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

// --- SETTINGS ---
function toggleSettings(show) {
    const settingsModal = document.getElementById('settingsModal');
    if (show) {
        // Fill in current values
        document.getElementById('settingStartHour').value = startHour;
        document.getElementById('settingEndHour').value = endHour;
        settingsModal.classList.add('open');
        // Re-create icons for the close button
        setTimeout(() => lucide.createIcons(), 10);
    } else {
        settingsModal.classList.remove('open');
    }
}

function saveSettings() {
    const newStart = parseInt(document.getElementById('settingStartHour').value);
    const newEnd = parseInt(document.getElementById('settingEndHour').value);

    if (newStart >= newEnd) {
        alert("Starttid må være før sluttid!");
        return;
    }

    startHour = newStart;
    endHour = newEnd;

    // Clear and rebuild grid
    document.getElementById('timeLabels').innerHTML = '';
    document.querySelectorAll('.day-col').forEach(col => col.remove());

    // Re-initialize grid and fetch appointments
    initGrid();
    fetchAppointments();
    toggleSettings(false);
}
