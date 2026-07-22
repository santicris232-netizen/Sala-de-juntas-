import { formatDate } from './utils.js';

// State Variables
let currentUser = null;
let selectedCompany = null;
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed
let selectedDateStr = formatDate(new Date()); // YYYY-MM-DD
let bookings = [];

// DOM Elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const companyButtons = document.querySelectorAll('.company-btn');
const btnLoginSubmit = document.getElementById('btn-login-submit');

const displayUsername = document.getElementById('display-username');
const userBadge = document.getElementById('user-badge');
const logoutBtn = document.getElementById('logout-btn');

const calendarMonthYear = document.getElementById('calendar-month-year');
const calendarDaysGrid = document.getElementById('calendar-days');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');

const displaySelectedDate = document.getElementById('selected-date-str');
const dayTimeline = document.getElementById('day-timeline');

const bookingForm = document.getElementById('booking-form');
const inputBookingDate = document.getElementById('booking-date');
const inputBookingTitle = document.getElementById('booking-title');
const inputBookingStart = document.getElementById('booking-start');
const inputBookingEnd = document.getElementById('booking-end');
const summaryCompany = document.getElementById('summary-company');
const summaryOrganizer = document.getElementById('summary-organizer');
const upcomingMeetingsList = document.getElementById('upcoming-meetings-list');
const notificationContainer = document.getElementById('notification-container');

// List of Month Names in Spanish
const MONTHS_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

/* ==========================================================================
   INITIALIZATION & SESSION MANAGEMENT
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // Set initial date fields to today
    const todayStr = formatDate(new Date());
    inputBookingDate.value = todayStr;
    inputBookingDate.min = todayStr; // Can't book in the past

    // Check existing session
    const savedSession = localStorage.getItem('sala_juntas_user');
    if (savedSession) {
        currentUser = JSON.parse(savedSession);
        loginUser(currentUser);
    }

    // Set default times (e.g. next hour start)
    setDefaultTimes();
});

// Select Company Event
companyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        companyButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedCompany = btn.dataset.company;
        
        // Update temporary body theme during selection
        document.body.className = `theme-${selectedCompany}`;
        
        validateLoginBtn();
    });
});

// Validate name & company selection
usernameInput.addEventListener('input', validateLoginBtn);

function validateLoginBtn() {
    const hasName = usernameInput.value.trim().length > 0;
    const hasCompany = selectedCompany !== null;
    btnLoginSubmit.disabled = !(hasName && hasCompany);
}

// Login Submit
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = usernameInput.value.trim();
    if (!name || !selectedCompany) return;

    currentUser = { name, company: selectedCompany };
    localStorage.setItem('sala_juntas_user', JSON.stringify(currentUser));
    
    loginUser(currentUser);
    showNotification('Sesión iniciada con éxito', 'success');
});

// Logout Event
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('sala_juntas_user');
    currentUser = null;
    selectedCompany = null;
    
    // Reset layout
    document.body.className = '';
    dashboardSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
    
    // Clear forms
    loginForm.reset();
    companyButtons.forEach(b => b.classList.remove('selected'));
    btnLoginSubmit.disabled = true;
});

function loginUser(user) {
    // Apply body theme class
    document.body.className = `theme-${user.company}`;
    
    // Update labels
    displayUsername.textContent = user.name;
    userBadge.textContent = user.company;
    summaryCompany.textContent = user.company.toUpperCase();
    summaryOrganizer.textContent = user.name;

    // Transition views
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');

    // Fetch and initialize dashboard
    fetchBookings();
    
    // Setup polling (every 10 seconds)
    if (window.bookingInterval) clearInterval(window.bookingInterval);
    window.bookingInterval = setInterval(fetchBookings, 10000);
}

/* ==========================================================================
   API INTERACTOR
   ========================================================================== */
async function fetchBookings() {
    try {
        const response = await fetch('/api/bookings');
        if (!response.ok) throw new Error('Error al conectar con la base de datos');
        
        bookings = await response.json();
        
        renderCalendar();
        renderTimeline();
        renderUpcoming();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Submit Booking Form
bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const bookingData = {
        title: inputBookingTitle.value.trim(),
        company: currentUser.company,
        organizer: currentUser.name,
        date: inputBookingDate.value,
        startTime: inputBookingStart.value,
        endTime: inputBookingEnd.value
    };

    try {
        const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'No se pudo crear la reserva');
        }

        showNotification('Sala reservada correctamente', 'success');
        
        // Reset only inputs except date
        inputBookingTitle.value = '';
        setDefaultTimes();
        
        // Refresh bookings and select the date that was booked
        selectedDateStr = bookingData.date;
        const [year, month, day] = selectedDateStr.split('-').map(Number);
        currentYear = year;
        currentMonth = month - 1; // JS months are 0-indexed
        
        await fetchBookings();
    } catch (error) {
        showNotification(error.message, 'error');
    }
});

// Delete Booking Action
async function deleteBooking(id) {
    if (!confirm('¿Estás seguro de que deseas cancelar esta reserva?')) return;

    try {
        const response = await fetch(`/api/bookings/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Error al eliminar la reserva');

        showNotification('Reserva cancelada correctamente', 'success');
        fetchBookings();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

/* ==========================================================================
   UI RENDERING: CALENDAR & TIMELINE
   ========================================================================== */
function renderCalendar() {
    calendarMonthYear.textContent = `${MONTHS_ES[currentMonth]} ${currentYear}`;
    calendarDaysGrid.innerHTML = '';

    // First day of the month
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    // Number of days in the current month
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    // Number of days in the previous month
    const prevTotalDays = new Date(currentYear, currentMonth, 0).getDate();

    // Render empty spaces / previous month days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('calendar-day', 'other-month');
        const dayNum = prevTotalDays - i;
        dayDiv.innerHTML = `<span class="day-num">${dayNum}</span>`;
        calendarDaysGrid.appendChild(dayDiv);
    }

    // Render current month days
    const today = new Date();
    const todayStr = formatDate(today);

    for (let day = 1; day <= totalDays; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('calendar-day');
        
        // Build this cell's ISO date string (YYYY-MM-DD)
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        if (dateStr === todayStr) {
            dayDiv.classList.add('today');
        }
        if (dateStr === selectedDateStr) {
            dayDiv.classList.add('selected-day');
        }

        dayDiv.innerHTML = `<span class="day-num">${day}</span>`;

        // Render dot indicators for this day's bookings
        const dayBookings = bookings.filter(b => b.date === dateStr);
        if (dayBookings.length > 0) {
            const dotsContainer = document.createElement('div');
            dotsContainer.classList.add('day-indicators');
            
            // Render up to 4 dot indicators
            dayBookings.slice(0, 4).forEach(b => {
                const dot = document.createElement('span');
                dot.classList.add('indicator-dot', b.company);
                dotsContainer.appendChild(dot);
            });
            dayDiv.appendChild(dotsContainer);
        }

        // Cell Click Handler
        dayDiv.addEventListener('click', () => {
            selectedDateStr = dateStr;
            inputBookingDate.value = dateStr;
            
            // Refresh styles
            document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected-day'));
            dayDiv.classList.add('selected-day');
            
            renderTimeline();
        });

        calendarDaysGrid.appendChild(dayDiv);
    }
}

// Navigation Calendar Controls
prevMonthBtn.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar();
});

// Update selected date from date picker input
inputBookingDate.addEventListener('change', (e) => {
    selectedDateStr = e.target.value;
    const [year, month, day] = selectedDateStr.split('-').map(Number);
    currentYear = year;
    currentMonth = month - 1;
    renderCalendar();
    renderTimeline();
});

// Render the Timeline for the selected day
function renderTimeline() {
    // Format friendly date
    const [year, month, day] = selectedDateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    let friendlyDate = dateObj.toLocaleDateString('es-ES', options);
    friendlyDate = friendlyDate.charAt(0).toUpperCase() + friendlyDate.slice(1);
    displaySelectedDate.textContent = friendlyDate;

    dayTimeline.innerHTML = '';
    
    // Filter and sort bookings chronologically
    const dayBookings = bookings
        .filter(b => b.date === selectedDateStr)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (dayBookings.length === 0) {
        dayTimeline.innerHTML = `
            <div class="timeline-empty">
                <i class="fa-solid fa-face-smile" style="font-size: 1.5rem; margin-bottom: 8px; display: block; opacity: 0.7;"></i>
                No hay reuniones programadas para este día.
            </div>`;
        return;
    }

    dayBookings.forEach(b => {
        const card = document.createElement('div');
        card.classList.add('timeline-card', b.company);
        
        // Show delete button only if it belongs to current user AND is the same company
        const isOwner = currentUser && b.organizer === currentUser.name && b.company === currentUser.company;
        const deleteBtnHtml = isOwner 
            ? `<button class="delete-booking-btn" onclick="deleteBooking('${b.id}')" title="Cancelar reserva">
                <i class="fa-solid fa-trash-can"></i>
               </button>` 
            : '';

        card.innerHTML = `
            <div class="company-stripe"></div>
            <div class="timeline-card-content">
                <div class="meeting-info">
                    <span class="meeting-time">
                        <i class="fa-regular fa-clock"></i> ${b.startTime} - ${b.endTime}
                    </span>
                    <span class="meeting-title">${b.title}</span>
                    <span class="meeting-meta">
                        Organiza: <span class="org-name">${b.organizer}</span>
                        <span class="company-tag">${b.company}</span>
                    </span>
                </div>
                ${deleteBtnHtml}
            </div>
        `;
        dayTimeline.appendChild(card);
    });
}

// Render Upcoming Bookings List
function renderUpcoming() {
    upcomingMeetingsList.innerHTML = '';
    
    const todayStr = formatDate(new Date());
    
    // Filter bookings starting today, sorting them
    const futureBookings = bookings
        .filter(b => b.date >= todayStr)
        .sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.startTime.localeCompare(b.startTime);
        })
        .slice(0, 10); // Show only top 10

    if (futureBookings.length === 0) {
        upcomingMeetingsList.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 12px 0;">No hay reservas futuras.</div>`;
        return;
    }

    futureBookings.forEach(b => {
        const item = document.createElement('div');
        item.classList.add('upcoming-item', b.company);
        
        // Format date slightly
        const [y, m, d] = b.date.split('-');
        const dateShort = `${d}/${m}`;

        item.innerHTML = `
            <div class="meeting-name-container">
                <div class="company-indicator-bar"></div>
                <div class="meeting-details">
                    <span class="meeting-title-text">${b.title}</span>
                    <span class="meeting-time-text">${b.startTime} - ${b.endTime} (${b.organizer})</span>
                </div>
            </div>
            <span class="meeting-date-badge">${dateShort}</span>
        `;
        upcomingMeetingsList.appendChild(item);
    });
}

/* ==========================================================================
   HELPERS & UTILS
   ========================================================================== */
function setDefaultTimes() {
    const now = new Date();
    // Round to next 15-minute mark for start time
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    now.setMinutes(roundedMinutes);
    now.setSeconds(0);
    
    const startStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // End time is 1 hour later
    now.setHours(now.getHours() + 1);
    const endStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    inputBookingStart.value = startStr;
    inputBookingEnd.value = endStr;
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.classList.add('notification', type);
    
    const icon = type === 'success' 
        ? '<i class="fa-solid fa-circle-check"></i>' 
        : '<i class="fa-solid fa-circle-exclamation"></i>';
        
    notification.innerHTML = `${icon} <span>${message}</span>`;
    notificationContainer.appendChild(notification);
    
    // Auto remove
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 4000);
}
