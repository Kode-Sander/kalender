// --- KONFIGURASJON ---
const API_BASE_URL = 'http://localhost:3000/api';
const startHour = 7;
const endHour = 17;
const hourHeight = 60; // matcher CSS var
let appointments = [];

// --- INITIALISERING ---
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initGrid();
    setupCurrentTime();
    setInterval(setupCurrentTime, 60000); // Oppdater rød linje hvert minutt
    fetchAppointments(); // Last inn avtaler fra backend
});

// --- API FUNKSJONER ---
async function fetchAppointments() {
    try {
        const response = await fetch(`${API_BASE_URL}/appointments`);
        if (!response.ok) {
            throw new Error('Kunne ikke laste avtaler');
        }
        appointments = await response.json();
        renderEvents();
    } catch (error) {
        console.error("Klarte ikke laste avtaler:", error);
        alert("Kunne ikke laste avtaler. Sjekk at serveren kjører på port 3000.");
    }
}

async function createAppointment(appt) {
    try {
        const response = await fetch(`${API_BASE_URL}/appointments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appt)
        });
        if (!response.ok) {
            throw new Error('Kunne ikke lagre avtale');
        }
        await fetchAppointments(); // Last inn listen på nytt
        return true;
    } catch (error) {
        console.error("Klarte ikke lagre avtale:", error);
        alert("Kunne ikke lagre avtale. Prøv igjen.");
        return false;
    }
}

async function updateAppointment(id, appt) {
    // For enkelhets skyld sletter vi den gamle og lager en ny
    // I en produksjonsapp ville vi hatt en PUT/PATCH endpoint
    try {
        await deleteAppointmentById(id);
        return await createAppointment({ ...appt, id });
    } catch (error) {
        console.error("Klarte ikke oppdatere avtale:", error);
        alert("Kunne ikke oppdatere avtale. Prøv igjen.");
        return false;
    }
}

async function deleteAppointmentById(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/appointments/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            throw new Error('Kunne ikke slette avtale');
        }
        await fetchAppointments(); // Last inn listen på nytt
        return true;
    } catch (error) {
        console.error("Klarte ikke slette avtale:", error);
        alert("Kunne ikke slette avtale. Prøv igjen.");
        return false;
    }
}

// --- GRID RENDERING ---
function initGrid() {
    const gridBody = document.getElementById('gridBody');
    const timeLabels = document.getElementById('timeLabels');

    // 1. Time Labels
    for (let h = startHour; h <= endHour; h++) {
        const timeSlot = document.createElement('div');
        timeSlot.className = 'time-slot';
        timeSlot.innerText = h.toString().padStart(2,'0') + ":00";
        timeLabels.appendChild(timeSlot);
    }

    // 2. Day Columns
    for (let d = 0; d < 7; d++) {
        const col = document.createElement('div');
        col.className = 'day-col';
        col.id = `day-${d}`;

        // Hvit bakgrunn for arbeidstid (08:00 - 16:00 f.eks)
        const workBg = document.createElement('div');
        workBg.className = 'working-hours-bg';
        workBg.style.top = (8 - startHour) * hourHeight + 'px'; // Start 08:00
        workBg.style.height = (8 * hourHeight) + 'px'; // Varer 8 timer
        col.appendChild(workBg);

        // Grid linjer
        for (let h = startHour; h < endHour; h++) {
            const line = document.createElement('div');
            line.className = 'grid-line-horizontal';
            line.style.top = ((h - startHour) * hourHeight) + 'px';
            col.appendChild(line);
        }

        // Klikk på kolonne for å lage ny avtale
        col.addEventListener('click', (e) => handleGridClick(e, d));

        gridBody.appendChild(col);
    }
}

// --- EVENT RENDERING ---
function renderEvents() {
    // Fjern eksisterende events
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
            <div class="event-sub">Sander</div>
        `;

        // Klikk på event for å redigere/slette
        card.addEventListener('click', (e) => {
            e.stopPropagation(); // Hindre grid-klikk
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
    // Fjern gammel linje
    const oldLine = document.querySelector('.now-indicator');
    if(oldLine) oldLine.remove();

    const now = new Date();
    const currentDay = now.getDay() - 1; // 0 = Søndag i JS, men vi bruker 0 = Mandag
    // Justering hvis det er søndag (JS:0 -> Vår:6)
    const adjustedDay = currentDay === -1 ? 6 : currentDay;

    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    // Sjekk om vi er innenfor visningstiden
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
    // Regn ut tid basert på Y-posisjon
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top; // Piksler fra toppen av kolonnen
    const hoursFromStart = y / hourHeight;

    const clickedHour = startHour + Math.floor(hoursFromStart);
    // Runde til nærmeste halvtime eller heltime? La oss ta nærmeste heltime for enkelhet
    const startTimeStr = `${clickedHour.toString().padStart(2,'0')}:00`;
    const endTimeStr = `${(clickedHour+1).toString().padStart(2,'0')}:00`;

    // Reset form
    inputId.value = '';
    inputPatient.value = '';
    inputStart.value = startTimeStr;
    inputEnd.value = endTimeStr;
    inputDayIndex.value = dayIndex;
    inputType.selectedIndex = 0;

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

    btnDelete.style.display = 'block';
    modalTitle.innerText = "Rediger avtale";

    openModal();
}

async function saveAppointment() {
    const id = inputId.value;
    const newAppt = {
        day: parseInt(inputDayIndex.value),
        start: inputStart.value,
        end: inputEnd.value,
        patient: inputPatient.value || "Ukjent pasient",
        type: inputType.value
    };

    let success;
    if (id) {
        // Oppdater eksisterende
        success = await updateAppointment(parseInt(id), newAppt);
    } else {
        // Lag ny
        success = await createAppointment(newAppt);
    }

    if (success) {
        closeModal();
    }
}

async function deleteAppointment() {
    const id = inputId.value;
    if (id) {
        const success = await deleteAppointmentById(parseInt(id));
        if (success) {
            closeModal();
        }
    }
}

// Lukk modal hvis man klikker utenfor boksen
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});
