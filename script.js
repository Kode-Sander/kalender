// --- KONFIGURASJON ---
const API_URL = 'http://localhost:3000/api';
// Hent innstillinger fra nettleserens minne, eller bruk standard
let startHour = parseInt(localStorage.getItem('calendarStartHour')) || 7;
let endHour = parseInt(localStorage.getItem('calendarEndHour')) || 17;
const hourHeight = 60;

// Globale variabler
let appointments = [];
let practitioners = [];
let currentWeekStart = getStartOfWeek(new Date());
let currentView = 'week'; // 'day' or 'week'

// --- INITIALISERING ---
document.addEventListener('DOMContentLoaded', async () => {
    // Sjekk autentisering først
    try {
        const sessionCheck = await fetch(`${API_URL}/session`, { credentials: 'include' });
        const sessionData = await sessionCheck.json();

        if (!sessionData.authenticated) {
            // Ikke logget inn, redirect til login
            window.location.href = '/login.html';
            return;
        }
    } catch (error) {
        console.error('Session check failed:', error);
        window.location.href = '/login.html';
        return;
    }

    lucide.createIcons();
    initGrid();
    initDragAndDrop();
    updateHeaderDates();
    fetchPractitioners();
    fetchAppointments();
    setupCurrentTime();
    setInterval(setupCurrentTime, 60000);

    // Vis/skjul videolenke-felt basert på type
    document.getElementById('inputType').addEventListener('change', function() {
        const videoGroup = document.getElementById('videoLinkGroup');
        if (this.value.includes('Videokonsultasjon')) {
            videoGroup.style.display = 'block';
        } else {
            videoGroup.style.display = 'none';
            document.getElementById('inputVideoLink').value = '';
        }
    });
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
    const headerCells = document.querySelectorAll('.header-cell');
    const dateRangeSpan = document.querySelector('.current-date-range');
    const norwegianDayNames = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

    for (let i = 0; i < 7; i++) {
        const d = new Date(currentWeekStart);
        d.setDate(currentWeekStart.getDate() + i);

        if(headerCells[i + 1]) {
            const dayNum = headerCells[i + 1].querySelector('.day-num');
            if(dayNum) dayNum.innerText = d.getDate();

            // Update day name
            const dayName = headerCells[i + 1].childNodes[0];
            if(dayName && dayName.nodeType === Node.TEXT_NODE) {
                dayName.textContent = norwegianDayNames[i] + ' ';
            }
        }
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
        const response = await fetch(`${API_URL}/practitioners`, { credentials: 'include' });
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
        const response = await fetch(`${API_URL}/appointments?start=${startStr}&end=${endStr}&practitionerId=${practitionerId}`, { credentials: 'include' });
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
                video_link: appt.video_link,
                fullDate: startDate
            };
        });

        renderEvents();
    } catch (error) {
        console.error("Feil ved henting:", error);
    }
}

async function saveAppointment() {
    const appointmentId = document.getElementById('inputId').value;
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
        practitioner_id: practitionerId,
        video_link: document.getElementById('inputVideoLink').value || null
    };

    try {
        // Use PUT for update, POST for create
        const isUpdate = appointmentId && appointmentId !== '';
        const url = isUpdate ? `${API_URL}/appointments/${appointmentId}` : `${API_URL}/appointments`;
        const method = isUpdate ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (response.status === 409) {
            alert("Denne tiden kolliderer med en annen avtale!");
            return;
        }

        if (response.ok) {
            fetchAppointments();
            closeModal();
        } else {
            const errorData = await response.json();
            alert(`Feil: ${errorData.error || 'Ukjent feil'}`);
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
            method: 'DELETE',
            credentials: 'include'
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

// Global variable for drag state
let draggedAppointment = null;

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
        card.draggable = true;
        card.dataset.appointmentId = appt.id;

        const videoIcon = appt.video_link
            ? `<i data-lucide="video" size="12" style="margin-left:4px; color:#0052cc; cursor:pointer;"></i>`
            : '';

        card.innerHTML = `
            <div class="event-time">
                <span>${appt.start} - ${appt.end}</span>
                ${videoIcon}
            </div>
            <div class="event-title">${appt.patient}</div>
            <div class="event-sub">${appt.practitioner_name || 'Ukjent'}</div>
            <div class="resize-handle resize-handle-top"></div>
            <div class="resize-handle resize-handle-bottom"></div>
        `;

        // Drag events
        card.addEventListener('dragstart', (e) => {
            draggedAppointment = appt;
            card.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragend', (e) => {
            card.style.opacity = '1';
            draggedAppointment = null;
        });

        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('resize-handle')) return;
            e.stopPropagation();
            openModalForEdit(appt);
        });

        col.appendChild(card);

        // Add click handler for video icon after appending to DOM
        if (appt.video_link) {
            const videoIconEl = card.querySelector('[data-lucide="video"]');
            if (videoIconEl) {
                videoIconEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.open(appt.video_link, '_blank');
                });
            }
        }

        // Add resize handlers
        setupResizeHandlers(card, appt);
    });

    // Re-create all Lucide icons once after all events are rendered
    lucide.createIcons();
}

// Setup drag and drop on day columns
function initDragAndDrop() {
    document.querySelectorAll('.day-col').forEach((col, dayIndex) => {
        col.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        col.addEventListener('drop', async (e) => {
            e.preventDefault();
            if (!draggedAppointment) return;

            const rect = col.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const minutesFromStart = (y / hourHeight) * 60;
            const totalMinutes = (startHour * 60) + minutesFromStart;

            // Snap to 15-minute intervals
            const snappedMinutes = Math.round(totalMinutes / 15) * 15;
            const newStartHour = Math.floor(snappedMinutes / 60);
            const newStartMin = snappedMinutes % 60;

            // Calculate duration
            const oldStart = timeToMinutes(draggedAppointment.start);
            const oldEnd = timeToMinutes(draggedAppointment.end);
            const duration = oldEnd - oldStart;

            // Calculate new end time
            const newEndTotalMin = snappedMinutes + duration;
            const newEndHour = Math.floor(newEndTotalMin / 60);
            const newEndMin = newEndTotalMin % 60;

            // Update appointment
            const dateForCol = new Date(currentWeekStart);
            dateForCol.setDate(dateForCol.getDate() + dayIndex);

            const startDateTime = new Date(dateForCol);
            startDateTime.setHours(newStartHour, newStartMin, 0);

            const endDateTime = new Date(dateForCol);
            endDateTime.setHours(newEndHour, newEndMin, 0);

            await updateAppointmentTime(draggedAppointment.id, startDateTime, endDateTime);
        });
    });
}

async function updateAppointmentTime(appointmentId, newStart, newEnd) {
    const appt = appointments.find(a => a.id === appointmentId);
    if (!appt) return;

    const payload = {
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
        patient: appt.patient,
        type: appt.type,
        practitioner_id: appt.practitioner_id,
        video_link: appt.video_link || null
    };

    try {
        const response = await fetch(`${API_URL}/appointments/${appointmentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (response.status === 409) {
            alert("Denne tiden kolliderer med en annen avtale!");
            return;
        }

        if (response.ok) {
            await fetchAppointments();
        } else {
            const errorData = await response.json();
            alert(`Feil: ${errorData.error || 'Ukjent feil'}`);
        }
    } catch (error) {
        console.error("Feil ved oppdatering:", error);
        alert("Kunne ikke oppdatere avtalen");
    }
}

// Setup resize handlers for appointments
function setupResizeHandlers(card, appt) {
    const topHandle = card.querySelector('.resize-handle-top');
    const bottomHandle = card.querySelector('.resize-handle-bottom');

    let isResizing = false;
    let resizeDirection = null;
    let startY = 0;
    let startHeight = 0;
    let startTop = 0;

    const startResize = (e, direction) => {
        e.stopPropagation();
        e.preventDefault();
        isResizing = true;
        resizeDirection = direction;
        startY = e.clientY;
        startHeight = card.offsetHeight;
        startTop = card.offsetTop;
        card.style.userSelect = 'none';
        document.body.style.cursor = 'ns-resize';
    };

    const doResize = (e) => {
        if (!isResizing) return;
        e.preventDefault();

        const deltaY = e.clientY - startY;

        if (resizeDirection === 'bottom') {
            const newHeight = Math.max(30, startHeight + deltaY);
            card.style.height = newHeight + 'px';
        } else if (resizeDirection === 'top') {
            const newTop = startTop + deltaY;
            const newHeight = startHeight - deltaY;
            if (newHeight >= 30) {
                card.style.top = newTop + 'px';
                card.style.height = newHeight + 'px';
            }
        }
    };

    const stopResize = async (e) => {
        if (!isResizing) return;
        isResizing = false;
        document.body.style.cursor = '';
        card.style.userSelect = '';

        // Calculate new times
        const newTopPx = parseFloat(card.style.top);
        const newHeightPx = parseFloat(card.style.height);

        const startMinutesFromDayStart = (newTopPx / hourHeight) * 60;
        const durationMinutes = (newHeightPx / hourHeight) * 60;

        // Snap to 15-minute intervals
        const snappedStart = Math.round(startMinutesFromDayStart / 15) * 15;
        const snappedDuration = Math.max(15, Math.round(durationMinutes / 15) * 15);

        const totalStartMinutes = (startHour * 60) + snappedStart;
        const totalEndMinutes = totalStartMinutes + snappedDuration;

        const newStartHour = Math.floor(totalStartMinutes / 60);
        const newStartMin = totalStartMinutes % 60;
        const newEndHour = Math.floor(totalEndMinutes / 60);
        const newEndMin = totalEndMinutes % 60;

        // Calculate date
        const dateForAppt = new Date(appt.fullDate);
        const startDateTime = new Date(dateForAppt);
        startDateTime.setHours(newStartHour, newStartMin, 0);

        const endDateTime = new Date(dateForAppt);
        endDateTime.setHours(newEndHour, newEndMin, 0);

        await updateAppointmentTime(appt.id, startDateTime, endDateTime);
    };

    topHandle.addEventListener('mousedown', (e) => startResize(e, 'top'));
    bottomHandle.addEventListener('mousedown', (e) => startResize(e, 'bottom'));

    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
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

    // Reset video link field
    document.getElementById('inputVideoLink').value = '';
    document.getElementById('videoLinkGroup').style.display = 'none';

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

    // Set video link and show/hide field
    const videoLinkInput = document.getElementById('inputVideoLink');
    const videoLinkGroup = document.getElementById('videoLinkGroup');
    if (appt.type.includes('Videokonsultasjon')) {
        videoLinkInput.value = appt.video_link || '';
        videoLinkGroup.style.display = 'block';
    } else {
        videoLinkInput.value = '';
        videoLinkGroup.style.display = 'none';
    }

    btnDelete.style.display = 'block';
    modalTitle.innerText = "Rediger avtale";

    openModal();
}

modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

// --- AUTHENTICATION ---
async function logout() {
    try {
        const response = await fetch(`${API_URL}/logout`, {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Logout failed:', error);
        alert('Kunne ikke logge ut. Prøv igjen.');
    }
}

// --- VIEW TOGGLE (DAY/WEEK) ---
function setView(view) {
    currentView = view;

    // Update button states
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    if (view === 'day') {
        document.querySelector('.toggle-btn:first-child').classList.add('active');
        showDayView();
    } else {
        document.querySelector('.toggle-btn:nth-child(2)').classList.add('active');
        showWeekView();
    }
}

function showDayView() {
    // Hide all day columns except today
    const today = new Date();
    const todayIndex = today.getDay() - 1; // Convert to 0=Mon, 6=Sun
    const adjustedToday = todayIndex === -1 ? 6 : todayIndex;

    // Update grid to show only one column
    const gridHeader = document.querySelector('.grid-header');
    const gridBody = document.querySelector('.grid-body');

    gridHeader.style.gridTemplateColumns = '60px 1fr';
    gridBody.style.gridTemplateColumns = '60px 1fr';

    // Hide all day columns except today
    for (let i = 0; i < 7; i++) {
        const headerCell = document.querySelector(`.header-cell:nth-child(${i + 2})`);
        const dayCol = document.getElementById(`day-${i}`);

        if (i === adjustedToday) {
            if (headerCell) headerCell.style.display = 'block';
            if (dayCol) dayCol.style.display = 'block';
        } else {
            if (headerCell) headerCell.style.display = 'none';
            if (dayCol) dayCol.style.display = 'none';
        }
    }

    // Update date range text
    const dateRangeSpan = document.querySelector('.current-date-range');
    dateRangeSpan.innerText = today.toLocaleDateString('no-NO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function showWeekView() {
    // Show all day columns
    const gridHeader = document.querySelector('.grid-header');
    const gridBody = document.querySelector('.grid-body');

    gridHeader.style.gridTemplateColumns = '60px repeat(7, 1fr)';
    gridBody.style.gridTemplateColumns = '60px repeat(7, 1fr)';

    // Show all day columns
    for (let i = 0; i < 7; i++) {
        const headerCell = document.querySelector(`.header-cell:nth-child(${i + 2})`);
        const dayCol = document.getElementById(`day-${i}`);

        if (headerCell) headerCell.style.display = 'block';
        if (dayCol) dayCol.style.display = 'block';
    }

    // Restore week view date range
    updateHeaderDates();
}

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

    // Lagre til localStorage
    localStorage.setItem('calendarStartHour', startHour);
    localStorage.setItem('calendarEndHour', endHour);

    // Clear and rebuild grid
    document.getElementById('timeLabels').innerHTML = '';
    document.querySelectorAll('.day-col').forEach(col => col.remove());

    // Re-initialize grid and fetch appointments
    initGrid();
    fetchAppointments();
    toggleSettings(false);
}

// --- NAVIGATION SYSTEM ---
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    // Show selected section
    const section = document.getElementById(`section-${sectionName}`);
    if (section) {
        section.classList.add('active');
    }

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.classList.add('active');

    // Load section-specific data
    if (sectionName === 'video-consultations') {
        loadVideoConsultations();
    } else if (sectionName === 'practitioner-settings') {
        loadPractitionersGrid();
    } else if (sectionName === 'user-settings') {
        loadUserSettings();
    } else if (sectionName === 'notification-settings') {
        loadNotificationSettings();
    }

    // Re-create icons for new content
    setTimeout(() => lucide.createIcons(), 10);
}

// --- VIDEO CONSULTATIONS ---
async function loadVideoConsultations() {
    const container = document.getElementById('upcomingVideoConsultations');

    try {
        // Fetch all appointments with video links
        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 90); // Next 90 days

        const response = await fetch(
            `${API_URL}/appointments?start=${now.toISOString()}&end=${futureDate.toISOString()}`,
            { credentials: 'include' }
        );
        const allAppointments = await response.json();

        // Filter only video consultations
        const videoConsultations = allAppointments
            .filter(appt => appt.type.includes('Videokonsultasjon') && appt.video_link)
            .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

        if (videoConsultations.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">Ingen kommende videokonsultasjoner</p>';
            return;
        }

        container.innerHTML = videoConsultations.map(appt => {
            const startDate = new Date(appt.start_time);
            const practitioner = practitioners.find(p => p.id === appt.practitioner_id);

            return `
                <div class="video-consultation-card">
                    <div class="video-consultation-info">
                        <h4>${appt.patient}</h4>
                        <p>${startDate.toLocaleDateString('no-NO', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })} • ${practitioner ? practitioner.name : 'Ukjent'}</p>
                    </div>
                    <div class="video-consultation-actions">
                        <button class="icon-btn" onclick="window.open('${appt.video_link}', '_blank')" title="Start videomøte">
                            <i data-lucide="video" size="18"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        lucide.createIcons();
    } catch (error) {
        console.error('Error loading video consultations:', error);
        container.innerHTML = '<p style="color: #ff5630;">Kunne ikke laste videokonsultasjoner</p>';
    }
}

// --- USER SETTINGS ---
function loadUserSettings() {
    // Load user data from session
    const userName = document.getElementById('userName')?.textContent || '';
    const userEmail = document.querySelector('.user-details p')?.textContent || '';

    document.getElementById('userNameSetting').value = userName;
    document.getElementById('userEmailSetting').value = userEmail;

    // Load from localStorage if available
    const userPhone = localStorage.getItem('userPhone') || '';
    document.getElementById('userPhoneSetting').value = userPhone;
}

function saveUserSettings() {
    const name = document.getElementById('userNameSetting').value;
    const phone = document.getElementById('userPhoneSetting').value;

    // Save to localStorage
    localStorage.setItem('userPhone', phone);

    // Update sidebar display
    const userNameDisplay = document.getElementById('userName');
    if (userNameDisplay) {
        userNameDisplay.textContent = name;
    }

    alert('Brukerinnstillinger lagret!');
}

function changePassword() {
    const current = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;

    if (!current || !newPass || !confirm) {
        alert('Vennligst fyll ut alle feltene');
        return;
    }

    if (newPass !== confirm) {
        alert('Nye passord stemmer ikke overens');
        return;
    }

    if (newPass.length < 6) {
        alert('Passord må være minst 6 tegn');
        return;
    }

    // TODO: Implement password change API call
    alert('Passordendring er ikke implementert ennå (backend kreves)');
}

// --- PRACTITIONER SETTINGS ---
async function loadPractitionersGrid() {
    const grid = document.getElementById('practitionersGrid');

    if (practitioners.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted);">Ingen behandlere funnet</p>';
        return;
    }

    grid.innerHTML = practitioners.map(p => `
        <div class="practitioner-card" onclick="openEditPractitionerModal(${p.id})">
            <div class="practitioner-card-header">
                <div class="practitioner-color-badge" style="background: ${p.color};"></div>
                <div class="practitioner-info">
                    <h4>${p.name}</h4>
                    <p>${p.role}</p>
                </div>
            </div>
            ${p.username ? `<p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                <i data-lucide="user" size="12"></i> ${p.username}
            </p>` : ''}
        </div>
    `).join('');

    lucide.createIcons();
}

function openAddPractitionerModal() {
    document.getElementById('practitionerModalTitle').textContent = 'Legg til behandler';
    document.getElementById('practitionerId').value = '';
    document.getElementById('practitionerName').value = '';
    document.getElementById('practitionerRole').value = 'Psykolog';
    document.getElementById('practitionerColor').value = '#e6effc';
    document.getElementById('practitionerUsername').value = '';
    document.getElementById('practitionerPassword').value = '';
    document.getElementById('btnDeletePractitioner').style.display = 'none';

    document.getElementById('practitionerModal').classList.add('open');
    setTimeout(() => lucide.createIcons(), 10);
}

function openEditPractitionerModal(practitionerId) {
    const practitioner = practitioners.find(p => p.id === practitionerId);
    if (!practitioner) return;

    document.getElementById('practitionerModalTitle').textContent = 'Rediger behandler';
    document.getElementById('practitionerId').value = practitioner.id;
    document.getElementById('practitionerName').value = practitioner.name;
    document.getElementById('practitionerRole').value = practitioner.role;
    document.getElementById('practitionerColor').value = practitioner.color;
    document.getElementById('practitionerUsername').value = practitioner.username || '';
    document.getElementById('practitionerPassword').value = '';
    document.getElementById('btnDeletePractitioner').style.display = 'block';

    document.getElementById('practitionerModal').classList.add('open');
    setTimeout(() => lucide.createIcons(), 10);
}

function closePractitionerModal() {
    document.getElementById('practitionerModal').classList.remove('open');
}

async function savePractitioner() {
    const id = document.getElementById('practitionerId').value;
    const name = document.getElementById('practitionerName').value;
    const role = document.getElementById('practitionerRole').value;
    const color = document.getElementById('practitionerColor').value;
    const username = document.getElementById('practitionerUsername').value;
    const password = document.getElementById('practitionerPassword').value;

    if (!name || !role) {
        alert('Navn og rolle er påkrevd');
        return;
    }

    const payload = { name, role, color };
    if (username) payload.username = username;
    if (password) payload.password = password;

    try {
        const isUpdate = id && id !== '';
        const url = isUpdate ? `${API_URL}/practitioners/${id}` : `${API_URL}/practitioners`;
        const method = isUpdate ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            await fetchPractitioners();
            loadPractitionersGrid();
            closePractitionerModal();
            alert('Behandler lagret!');
        } else {
            const errorData = await response.json();
            alert(`Feil: ${errorData.error || 'Ukjent feil'}`);
        }
    } catch (error) {
        console.error('Error saving practitioner:', error);
        alert('Kunne ikke lagre behandler');
    }
}

async function deletePractitioner() {
    const id = document.getElementById('practitionerId').value;
    if (!id) return;

    if (!confirm('Er du sikker på at du vil slette denne behandleren?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/practitioners/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (response.ok) {
            await fetchPractitioners();
            loadPractitionersGrid();
            closePractitionerModal();
            alert('Behandler slettet');
        } else {
            const errorData = await response.json();
            alert(`Feil: ${errorData.error || 'Ukjent feil'}`);
        }
    } catch (error) {
        console.error('Error deleting practitioner:', error);
        alert('Kunne ikke slette behandler');
    }
}

// --- NOTIFICATION SETTINGS ---
function loadNotificationSettings() {
    // Load from localStorage
    document.getElementById('emailNewAppt').checked = localStorage.getItem('emailNewAppt') !== 'false';
    document.getElementById('emailCancelled').checked = localStorage.getItem('emailCancelled') !== 'false';
    document.getElementById('emailReminder').checked = localStorage.getItem('emailReminder') !== 'false';
    document.getElementById('smsNewAppt').checked = localStorage.getItem('smsNewAppt') === 'true';
    document.getElementById('smsReminder').checked = localStorage.getItem('smsReminder') !== 'false';
    document.getElementById('pushEnabled').checked = localStorage.getItem('pushEnabled') !== 'false';
}

function saveNotificationSettings() {
    // Save to localStorage
    localStorage.setItem('emailNewAppt', document.getElementById('emailNewAppt').checked);
    localStorage.setItem('emailCancelled', document.getElementById('emailCancelled').checked);
    localStorage.setItem('emailReminder', document.getElementById('emailReminder').checked);
    localStorage.setItem('smsNewAppt', document.getElementById('smsNewAppt').checked);
    localStorage.setItem('smsReminder', document.getElementById('smsReminder').checked);
    localStorage.setItem('pushEnabled', document.getElementById('pushEnabled').checked);

    alert('Varslingsinnstillinger lagret!');
}
