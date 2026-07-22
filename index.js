import { timeToMinutes, readBookings, writeBookings } from './functions/helpers.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        // Route: GET /api/bookings
        if (path === "/api/bookings" && request.method === "GET") {
            try {
                const bookings = await readBookings(env);
                return new Response(JSON.stringify(bookings), {
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            }
        }

        // Route: POST /api/bookings
        if (path === "/api/bookings" && request.method === "POST") {
            try {
                const body = await request.json();
                const { title, company, organizer, date, startTime, endTime } = body;

                // Validaciones simples
                if (!title || !company || !organizer || !date || !startTime || !endTime) {
                    return new Response(JSON.stringify({ error: 'Todos los campos son obligatorios' }), {
                        status: 400,
                        headers: { 
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                }

                // Validaciones de hora
                const startMin = timeToMinutes(startTime);
                const endMin = timeToMinutes(endTime);

                if (startMin >= endMin) {
                    return new Response(JSON.stringify({ error: 'La hora de inicio debe ser anterior a la hora de fin' }), {
                        status: 400,
                        headers: { 
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                }

                const bookings = await readBookings(env);

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
                        headers: { 
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        }
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
                await writeBookings(env, bookings);

                return new Response(JSON.stringify(newBooking), {
                    status: 201,
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            }
        }

        // Route: DELETE /api/bookings/:id
        if (path.startsWith("/api/bookings/") && request.method === "DELETE") {
            try {
                const id = path.substring("/api/bookings/".length);
                let bookings = await readBookings(env);
                
                const initialLength = bookings.length;
                bookings = bookings.filter(b => b.id !== id);

                if (bookings.length === initialLength) {
                    return new Response(JSON.stringify({ error: 'Reserva no encontrada' }), {
                        status: 404,
                        headers: { 
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                }

                await writeBookings(env, bookings);

                return new Response(JSON.stringify({ success: true, message: 'Reserva eliminada con éxito' }), {
                    status: 200,
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            }
        }

        // Handle CORS preflight options request
        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                }
            });
        }

        // Fallback to serving static assets from directory
        if (env.ASSETS) {
            return env.ASSETS.fetch(request);
        }

        return new Response("Not Found", { status: 404 });
    }
};
