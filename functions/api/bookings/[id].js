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

// Handler para DELETE /api/bookings/:id
export async function onRequestDelete(context) {
    try {
        const { id } = context.params;
        let bookings = await readBookings(context.env);
        
        const initialLength = bookings.length;
        bookings = bookings.filter(b => b.id !== id);

        if (bookings.length === initialLength) {
            return new Response(JSON.stringify({ error: 'Reserva no encontrada' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        await writeBookings(context.env, bookings);

        return new Response(JSON.stringify({ success: true, message: 'Reserva eliminada con éxito' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
