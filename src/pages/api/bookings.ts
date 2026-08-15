// @ts-nocheck
import type { APIRoute } from 'astro';
import { ApiError, createBooking, getCurrentCustomer } from '@/lib/api.js';
import { getSessionToken, clearSessionCookie } from '@/lib/session.js';

export const prerender = false;

interface BookingRequestBody {
  tourId?: string;
  tourDateId?: string;
  tourScheduleId?: string;
  guests?: number;
  numberOfChildren?: number;
  numberOfBabies?: number;
  numberOfPets?: number;        // add this
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = getSessionToken(cookies);
  if (!token) {
    return json({ message: 'Debes verificar tu correo antes de reservar.' }, 401);
  }

  let customer;
  try {
    customer = await getCurrentCustomer(token);
  } catch {
    clearSessionCookie(cookies);
    return json({ message: 'Tu sesión ha expirado. Verifica tu correo de nuevo para continuar.' }, 401);
  }

  let body: BookingRequestBody;
  try {
    body = await request.json();
  } catch {
    return json({ message: 'Cuerpo de la petición inválido.' }, 400);
  }

  const { tourId, tourDateId, tourScheduleId, guests, numberOfChildren, numberOfBabies, numberOfPets } = body;

  if (!tourId || !tourDateId || !tourScheduleId || !guests) {
    return json(
      { message: 'Faltan datos obligatorios: ruta, fecha, hora y número de personas.' },
      400
    );
  }

  try {
    const booking = await createBooking({
      customerId: customer.id,
      tourId,
      tourDateId,
      tourScheduleId,
      quantity: guests,
      numberOfChildren: numberOfChildren ?? 0,
      numberOfBabies: numberOfBabies ?? 0,
      numberOfPets: numberOfPets ?? 0   // add this
    });
    return json(booking, 201);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) {
        return json({ message: 'La ruta seleccionada ya no está disponible.' }, 404);
      }
      if (err.status === 400) {
        return json({ message: err.message }, 400);
      }
      // The backend enforces tour capacity per date/schedule and returns
      // 409 when it's full (or when the tour was deactivated between page
      // load and submit).
      if (err.status === 409) {
        const remaining = (err.body as any)?.remaining;
        const message =
          typeof remaining === 'number'
            ? remaining > 0
              ? `Solo quedan ${remaining} plaza(s) para esta salida. Reduce el número de personas o elige otra fecha/hora.`
              : 'Esta salida está completa. Elige otra fecha u hora.'
            : 'Esta excursión no está disponible en este momento.';
        return json({ message, remaining: remaining ?? null }, 409);
      }
    }
    console.error('Failed to create booking', err);
    return json(
      { message: 'No se ha podido completar la reserva. Inténtalo de nuevo más tarde.' },
      500
    );
  }
};

