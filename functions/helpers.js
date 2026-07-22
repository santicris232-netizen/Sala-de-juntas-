export function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

export async function readBookings(env) {
    if (!env || !env.BOOKINGS_KV) {
        throw new Error("El namespace de KV 'BOOKINGS_KV' no está vinculado. Por favor, asegúrate de vincularlo en la configuración de Cloudflare Pages.");
    }
    const raw = await env.BOOKINGS_KV.get('bookings');
    if (!raw) return [];
    try {
        return JSON.parse(raw);
    } catch (e) {
        console.error('Error parsing bookings from KV:', e);
        return [];
    }
}

export async function writeBookings(env, bookings) {
    if (!env || !env.BOOKINGS_KV) {
        throw new Error("El namespace de KV 'BOOKINGS_KV' no está vinculado. Por favor, asegúrate de vincularlo en la configuración de Cloudflare Pages.");
    }
    await env.BOOKINGS_KV.put('bookings', JSON.stringify(bookings));
}

// Enviar notificación por correo usando SendGrid
export async function sendNotificationEmail(env, booking) {
    try {
        const apiKey = env && env.SENDGRID_API_KEY;
        const from = env && env.FROM_EMAIL;
        const to = env && env.NOTIFY_EMAIL;

        if (!apiKey || !from || !to) {
            console.warn('[SendGrid] Omisión del envío de correo. Faltan variables: SENDGRID_API_KEY, FROM_EMAIL o NOTIFY_EMAIL');
            return;
        }

        // Dividir los correos en NOTIFY_EMAIL por comas si hay múltiples destinatarios
        const toArray = to.split(',').map(e => e.trim()).filter(Boolean).map(email => ({ email }));

        if (toArray.length === 0) {
            console.warn('[SendGrid] NOTIFY_EMAIL no contiene direcciones válidas.');
            return;
        }

        const subject = `📅 Nueva reserva: ${booking.title} - ${booking.organizer}`;
        const text = `${booking.organizer} ha agendado la sala de juntas el ${booking.date} de ${booking.startTime} a ${booking.endTime}.\n\nEmpresa: ${booking.company}\nID: ${booking.id}`;

        const body = {
            personalizations: [
                {
                    to: toArray
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
            console.error('Error enviando correo vía SendGrid:', resp.status, respText);
        } else {
            console.log(`[SendGrid] Correo de notificación enviado exitosamente a: ${to}`);
        }
    } catch (e) {
        console.error('Error en sendNotificationEmail:', e);
    }
}
