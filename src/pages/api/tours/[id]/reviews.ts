// @ts-nocheck
import type { APIRoute } from 'astro';
import { ApiError, createReview, getCurrentCustomer } from '@/lib/api.js';
import { getSessionToken, clearSessionCookie } from '@/lib/session.js';

export const prerender = false;

interface ReviewRequestBody {
  stars?: number;
  content?: string;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export const POST: APIRoute = async ({ params, request, cookies }) => {
  const token = getSessionToken(cookies);
  if (!token) {
    return json({ message: 'Debes iniciar sesión para dejar una reseña.' }, 401);
  }

  let customer;
  try {
    customer = await getCurrentCustomer(token);
  } catch {
    clearSessionCookie(cookies);
    return json({ message: 'Tu sesión ha expirado. Inicia sesión de nuevo para dejar tu reseña.' }, 401);
  }

  let body: ReviewRequestBody;
  try {
    body = await request.json();
  } catch {
    return json({ message: 'Cuerpo de la petición inválido.' }, 400);
  }

  const { stars, content } = body;
  if (!stars || stars < 1 || stars > 5) {
    return json({ message: 'Selecciona una puntuación entre 1 y 5 estrellas.' }, 400);
  }

  try {
    const review = await createReview(params.id as string, {
      customerId: customer.id,
      stars,
      content: content?.trim() || undefined
    });
    // The backend's INSERT ... RETURNING * doesn't join customer/tour
    // names — attach the display name we already have server-side so the
    // frontend can render the new review card without a second request.
    return json({ ...review, customer_name: customer.full_name }, 201);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        return json({ message: 'Ya has dejado una reseña para esta excursión.' }, 409);
      }
      if (err.status === 404) {
        return json({ message: 'Esta excursión ya no está disponible.' }, 404);
      }
      if (err.status === 400) {
        return json({ message: err.message }, 400);
      }
    }
    console.error('Failed to create review', err);
    return json(
      { message: 'No se ha podido publicar la reseña. Inténtalo de nuevo más tarde.' },
      500
    );
  }
};