const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'bookings.json');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data directory and file exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
}

// Helper to read bookings
function readBookings() {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const data = raw ? raw.trim() : '';
        if (!data) return [];
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading bookings:', error);
        return [];
    }
}

// Helper to write bookings
function writeBookings(bookings) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(bookings, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing bookings:', error);
        return false;
    }
}

// Helper to parse time string (HH:MM) to minutes since midnight for comparison
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// Endpoints
app.get('/api/bookings', (req, res) => {
    const bookings = readBookings();
    res.json(bookings);
});

app.post('/api/bookings', (req, res) => {
    const { title, company, organizer, date, startTime, endTime } = req.body;

    // Simple validations
    if (!title || !company || !organizer || !date || !startTime || !endTime) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Time validations
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);

    if (startMin >= endMin) {
        return res.status(400).json({ error: 'La hora de inicio debe ser anterior a la hora de fin' });
    }

    const bookings = readBookings();

    // Check for overlap on the same date
    const dateBookings = bookings.filter(b => b.date === date);
    const hasOverlap = dateBookings.some(b => {
        const existingStart = timeToMinutes(b.startTime);
        const existingEnd = timeToMinutes(b.endTime);
        
        // Two intervals [s1, e1] and [s2, e2] overlap if s1 < e2 and e1 > s2
        return startMin < existingEnd && endMin > existingStart;
    });

    if (hasOverlap) {
        return res.status(400).json({ error: 'Ya existe una reunión programada en este horario' });
    }

    // Create new booking
    const newBooking = {
        id: Date.now().toString(),
        title,
        company,
        organizer,
        date,
        startTime,
        endTime,
        createdAt: new Date().toISOString()
    };

    bookings.push(newBooking);
    
    if (writeBookings(bookings)) {
        res.status(201).json(newBooking);
    } else {
        res.status(500).json({ error: 'Error al guardar la reserva en el servidor' });
    }
});

app.delete('/api/bookings/:id', (req, res) => {
    const { id } = req.params;
    let bookings = readBookings();
    
    const initialLength = bookings.length;
    bookings = bookings.filter(b => b.id !== id);

    if (bookings.length === initialLength) {
        return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    if (writeBookings(bookings)) {
        res.status(200).json({ success: true, message: 'Reserva eliminada con éxito' });
    } else {
        res.status(500).json({ error: 'Error al actualizar las reservas en el servidor' });
    }
});

// Rutas explícitas sin extensión en la URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/tv', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tv.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor de Sala de Juntas corriendo en http://localhost:${PORT}`);
});
