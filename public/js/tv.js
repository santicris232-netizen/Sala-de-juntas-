// State
let bookings = [];
const startHour = 7; // Grid starts at 07:00
const endHour = 20;  // Grid ends at 20:00
const totalMinutes = (endHour - startHour) * 60; // 780 minutes total

// DOM elements
const tvClock = document.getElementById('tv-clock');
const tvDate = document.getElementById('tv-date');

const roomStatusCard = document.getElementById('room-status-card');
const statusLabel = document.getElementById('status-label');
const activeMeetingTitle = document.getElementById('active-meeting-title');
const activeMeetingCompany = document.getElementById('active-meeting-company');
const activeMeetingOrganizer = document.getElementById('active-meeting-organizer');
const countdownTitle = document.getElementById('countdown-title');
const countdownTimer = document.getElementById('countdown-timer');

const todayFeedList = document.getElementById('today-feed-list');
const bookingsBlocksArea = document.getElementById('bookings-blocks-area');
const currentTimeBar = document.getElementById('current-time-bar');

// Spanish date formatting utilities
const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

/* ==========================================================================
   CLOCK AND DATE UPDATER
   ========================================================================== */
function updateClock() {
    const now = new Date();
    
    // Time
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    tvClock.textContent = `${hours}:${minutes}:${seconds}`;

    // Date (only update date labels when seconds are 0 to save performance)
    if (now.getSeconds() === 0 || tvDate.textContent === '08:30:00' || tvDate.textContent === '') {
        const dayName = DAYS_ES[now.getDay()];
        const dayNum = now.getDate();
        const monthName = MONTHS_ES[now.getMonth()];
        const year = now.getFullYear();
        tvDate.textContent = `${dayName}, ${dayNum} de ${monthName} de ${year}`;
    }

    // Update real-time elements that depend on seconds
    updateTimeDependentStates();
}

// Start clock tick
setInterval(updateClock, 1000);
updateClock(); // Initial run

/* ==========================================================================
   DATA LOADER (POLLING)
   ========================================================================== */
async function loadBookings() {
    try {
        const response = await fetch('/api/bookings');
        if (!response.ok) throw new Error('API connection failed');
        bookings = await response.json();
        
        // Refresh dashboard layout
        updateDashboard();
    } catch (e) {
        console.error('Error fetching bookings:', e);
    }
}

// Initial pull and setup 5-second polling for immediate TV updates
loadBookings();
setInterval(loadBookings, 5000);

/* ==========================================================================
   DASHBOARD REFRESH LOGIC
   ========================================================================== */
function updateDashboard() {
    const todayStr = getTodayStr();
    
    // Filter today's bookings and sort chronologically
    const todayBookings = bookings
        .filter(b => b.date === todayStr)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

    renderTodayFeed(todayBookings);
    renderSchedulerBlocks(todayBookings);
    updateTimeDependentStates(todayBookings);
}

// Render feed list of today's meetings (left column bottom)
function renderTodayFeed(todayBookings) {
    todayFeedList.innerHTML = '';
    
    if (todayBookings.length === 0) {
        todayFeedList.innerHTML = `<div class="feed-empty"><i class="fa-regular fa-calendar" style="font-size: 1.8rem; display:block; margin-bottom: 10px; opacity: 0.5;"></i>No hay reuniones programadas para hoy.</div>`;
        return;
    }

    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();

    todayBookings.forEach(b => {
        const item = document.createElement('div');
        item.classList.add('feed-item', b.company);
        
        const startMin = timeToMinutes(b.startTime);
        const endMin = timeToMinutes(b.endTime);
        const isActive = currentMin >= startMin && currentMin < endMin;
        
        if (isActive) {
            item.classList.add('active-item');
        }

        item.innerHTML = `
            <div class="details">
                <span class="time">${b.startTime} - ${b.endTime} ${isActive ? '• EN CURSO' : ''}</span>
                <span class="title">${b.title}</span>
                <span class="meta">Organiza: <strong>${b.organizer}</strong></span>
            </div>
            <span class="feed-badge">${b.company}</span>
        `;
        todayFeedList.appendChild(item);
    });
}

// Render calendar block overlays (right column scheduler)
function renderSchedulerBlocks(todayBookings) {
    bookingsBlocksArea.innerHTML = '';

    todayBookings.forEach(b => {
        const startMin = timeToMinutes(b.startTime);
        const endMin = timeToMinutes(b.endTime);
        
        // Convert to scheduler relative minutes (relative to 07:00 AM)
        const gridStartMin = startMin - (startHour * 60);
        const durationMin = endMin - startMin;

        // Clamp booking times to the visible scheduler grid (07:00 - 20:00)
        if (gridStartMin + durationMin <= 0 || gridStartMin >= totalMinutes) {
            return; // Out of bounds
        }

        const clampedStart = Math.max(0, gridStartMin);
        const clampedEnd = Math.min(totalMinutes, gridStartMin + durationMin);
        const clampedDuration = clampedEnd - clampedStart;

        // Calculate positions
        const topPercent = (clampedStart / totalMinutes) * 100;
        const heightPercent = (clampedDuration / totalMinutes) * 100;

        const block = document.createElement('div');
        block.classList.add('booking-block', b.company);
        if (clampedDuration <= 35) {
            block.classList.add('short-block');
        }
        block.style.top = `${topPercent}%`;
        block.style.height = `${heightPercent}%`;

        block.innerHTML = `
            <span class="block-time">${b.startTime} - ${b.endTime}</span>
            <span class="block-title">${b.title}</span>
            <span class="block-org">Organiza: <strong>${b.organizer}</strong></span>
        `;

        bookingsBlocksArea.appendChild(block);
    });
}

/* ==========================================================================
   TIME DEPENDENT LOGIC (SECONDS & DYNAMIC POSITIONING)
   ========================================================================== */
function updateTimeDependentStates(todayBookingsList) {
    // If not supplied, filter active list from current state
    const todayBookings = todayBookingsList || bookings.filter(b => b.date === getTodayStr()).sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const currentSecs = now.getSeconds();
    const absoluteCurrentSeconds = currentMin * 60 + currentSecs;

    // 1. UPDATE CURRENT TIME RED BAR
    const gridStartSeconds = (startHour * 60) * 60;
    const gridEndSeconds = (endHour * 60) * 60;
    const totalSeconds = gridEndSeconds - gridStartSeconds;

    if (absoluteCurrentSeconds >= gridStartSeconds && absoluteCurrentSeconds <= gridEndSeconds) {
        currentTimeBar.style.display = 'block';
        const topPercent = ((absoluteCurrentSeconds - gridStartSeconds) / totalSeconds) * 100;
        currentTimeBar.style.styleValue = topPercent;
        currentTimeBar.style.top = `${topPercent}%`;
    } else {
        currentTimeBar.style.display = 'none';
    }

    // 2. DETECT CURRENT ACTIVE OR NEXT MEETING
    let activeMeeting = null;
    let nextMeeting = null;

    for (const b of todayBookings) {
        const startMin = timeToMinutes(b.startTime);
        const endMin = timeToMinutes(b.endTime);

        if (currentMin >= startMin && currentMin < endMin) {
            activeMeeting = b;
            break;
        } else if (startMin > currentMin) {
            nextMeeting = b;
            break; // Since list is sorted, first match is next
        }
    }

    // Reset status class
    roomStatusCard.className = 'status-card glass';

    if (activeMeeting) {
        // Sala de juntas ocupada
        roomStatusCard.classList.add(`state-${activeMeeting.company}`);
        statusLabel.textContent = 'EN REUNIÓN';
        activeMeetingTitle.textContent = activeMeeting.title;
        activeMeetingCompany.textContent = activeMeeting.company.toUpperCase();
        activeMeetingOrganizer.innerHTML = `<i class="fa-regular fa-user"></i> Organiza: ${activeMeeting.organizer}`;
        
        countdownTitle.textContent = 'TERMINA EN';
        
        // Calculate detailed countdown in seconds
        const endSecs = timeToMinutes(activeMeeting.endTime) * 60;
        const remainingSeconds = endSecs - absoluteCurrentSeconds;
        countdownTimer.textContent = formatCountdown(remainingSeconds);
    } else {
        // Sala de juntas libre
        roomStatusCard.classList.add('state-available');
        statusLabel.textContent = 'DISPONIBLE';
        activeMeetingTitle.textContent = 'Libre para reuniones';
        activeMeetingCompany.textContent = 'SALA LIBRE';
        activeMeetingOrganizer.innerHTML = `<i class="fa-regular fa-user"></i> Sin organizador`;

        if (nextMeeting) {
            countdownTitle.textContent = 'SIGUIENTE REUNIÓN EN';
            const startSecs = timeToMinutes(nextMeeting.startTime) * 60;
            const remainingSeconds = startSecs - absoluteCurrentSeconds;
            countdownTimer.textContent = formatCountdown(remainingSeconds);
        } else {
            countdownTitle.textContent = 'SIN MÁS REUNIONES HOY';
            countdownTimer.textContent = '--:--:--';
        }
    }
}

/* ==========================================================================
   HELPERS & UTILS
   ========================================================================== */
function getTodayStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function formatCountdown(totalSecs) {
    if (totalSecs <= 0) return '00:00:00';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/* ==========================================================================
   FULLSCREEN LOGIC
   ========================================================================== */
const fullscreenBtn = document.getElementById('fullscreen-btn');
if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            fullscreenBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
            fullscreenBtn.title = 'Salir de Pantalla Completa';
        } else {
            fullscreenBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
            fullscreenBtn.title = 'Pantalla Completa';
        }
    });
}
