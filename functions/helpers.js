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
