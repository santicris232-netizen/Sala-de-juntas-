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

// Enviar notificación por correo usando SendGrid (requiere variables de entorno SENDGRID_API_KEY, FROM_EMAIL y NOTIFY_EMAIL)
async function sendNotificationEmail(env, booking) {
    try {
        const apiKey = env && env.SENDGRID_API_KEY;
        const from = env && env.FROM_EMAIL;
        const to = env && env.NOTIFY_EMAIL;

        // DEBUG temporal: confirma qué variables está leyendo realmente el entorno.
        // Puedes quitar este bloque una vez confirmes que todo funciona en producción.
        console.log('DEBUG SendGrid vars:', {
            apiKeyExists: !!apiKey,
            apiKeyPrefix: apiKey ? apiKey.substring(0, 5) : 'NO EXISTE',
            from: from || 'NO EXISTE',
            to: to || 'NO EXISTE'
        });

        if (!apiKey || !from || !to) {
            console.warn('SendGrid no está configurado. Omisión del envío de correo. Variables necesarias: SENDGRID_API_KEY, FROM_EMAIL, NOTIFY_EMAIL');
            return;
        }

        const subject = `Nueva reserva: ${booking.title}`;
        const text = `Se ha creado una nueva reserva.\n\nTítulo: ${booking.title}\nEmpresa: ${booking.company}\nOrganizador: ${booking.organizer}\nFecha: ${booking.date}\nHora inicio: ${booking.startTime}\nHora fin: ${booking.endTime}\nID: ${booking.id}\nCreada: ${booking.createdAt}`;

        const body = {
            personalizations: [
                {
                    to: [{ email: to }]
                }
            ],
            from: { email: from },
            subject: subject,
            content: [
                { type: 'text/plain', value: text }
            ]
        };

        const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!resp.ok) {
            const respText = await resp.text();
            console.error('Error enviando correo via SendGrid:', resp.status, respText);
        }
    } catch (e) {
        console.error('Error en sendNotificationEmail:', e);
    }
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

        // Intentar enviar notificación por correo (no bloqueante)
        try {
            await sendNotificationEmail(context.env, newBooking);
        } catch (e) {
            console.error('Fallo al enviar notificación por correo:', e);
        }

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