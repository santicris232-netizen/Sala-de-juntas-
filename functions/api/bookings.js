function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

async function readBookings(env) {
    if (!env || !env.BOOKINGS_KV) {
        throw new Error("El namespace de KV 'BOOKINGS_KV' no está vinculado. Por favor, asegúrate de vincularlo en la configuración de Cloudflare Pages.");
    }
    const raw = await env.BOOKINGS_KV.get("bookings");
    if (!raw) return [];
    try {
        return JSON.parse(raw);
    } catch (e) {
        console.error('Error parsing bookings from KV:', e);
        return [];
    }
}

async function writeBookings(env, bookings) {
    if (!env || !env.BOOKINGS_KV) {
        throw new Error("El namespace de KV 'BOOKINGS_KV' no está vinculado. Por favor, asegúrate de vincularlo en la configuración de Cloudflare Pages.");
    }
    await env.BOOKINGS_KV.put("bookings", JSON.stringify(bookings));
}

// Handler para GET /api/bookings
export async function onRequestGet(context) {
    try {
        const bookings = await readBookings(context.env);
        return new Response(JSON.stringify(bookings), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Handler para POST /api/bookings
export async function onRequestPost(context) {
    try {
        const body = await context.request.json();
        const { title, company, organizer, date, startTime, endTime } = body;

        // Validaciones simples
        if (!title || !company || !organizer || !date || !startTime || !endTime) {
            return new Response(JSON.stringify({ error: 'Todos los campos son obligatorios' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validaciones de hora
        const startMin = timeToMinutes(startTime);
        const endMin = timeToMinutes(endTime);

        if (startMin >= endMin) {
            return new Response(JSON.stringify({ error: 'La hora de inicio debe ser anterior a la hora de fin' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const bookings = await readBookings(context.env);

        // Validar que no se traslapen en la misma fecha
        const dateBookings = bookings.filter(b => b.date === date);
        const hasOverlap = dateBookings.some(b => {
            const existingStart = timeToMinutes(b.startTime);
            const existingEnd = timeToMinutes(b.endTime);
            
            // Dos intervalos [s1, e1] y [s2, e2] se traslapan si s1 < e2 y e1 > s2
            return startMin < existingEnd && endMin > existingStart;
        });

        if (hasOverlap) {
            return new Response(JSON.stringify({ error: 'Ya existe una reunión programada en este horario' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Crear nueva reserva
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
        await writeBookings(context.env, bookings);

        return new Response(JSON.stringify(newBooking), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
