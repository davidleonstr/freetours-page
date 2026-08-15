// Server-only helper for talking to the tours/bookings API.
//
// This must never be imported from a client-side <script> block — it reads
// the API key from a server-only env var (no PUBLIC_ prefix, see
// .env.example) and would leak it to the browser if bundled client-side.
// Use it from Astro frontmatter (runs server-side) or from src/pages/api/*
// endpoints.
//
// NOTE: this backend is a *free* tour catalog — there is no price/currency
// field on tours and no checkout/payment endpoints. Auth has no passwords
// or confirmation codes: /auth/register creates the account and hands back
// a session token immediately, and /auth/login only needs the email on
// file (see the backend's src/routes/auth.js for the full rationale).

const API_BASE_URL = import.meta.env.API_BASE_URL ?? 'http://localhost:3000';
const API_KEY = import.meta.env.API_KEY;

if (!API_KEY) {
  console.warn('[api] API_KEY is not set — requests to the booking API will fail with 401.');
}

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message ?? `API request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      'x-api-key': API_KEY ?? '',
      ...(options.headers ?? {})
    }
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return body;
}

// --- Tours — public catalog browsing, x-api-key only, no publish key ---

export function getTours({ active = true } = {}) {
  const params = new URLSearchParams();
  if (active !== undefined) params.set('active', String(active));
  return apiFetch(`/tours?${params.toString()}`);
}

export function getTour(id) {
  return apiFetch(`/tours/${id}`);
}

// GET /tours list doesn't join gallery images (only GET /tours/:id does),
// so the catalog grid fetches each tour's gallery separately to show a
// cover photo.
export function getTourGallery(tourId) {
  return apiFetch(`/tours/${tourId}/gallery`);
}

// A tour's available departure times. Bookings require a
// tour_schedule_id, so the frontend needs to look these up — both
// server-side (Booking.astro pre-selecting a tour) and, via
// src/pages/api/tours/[id]/schedules.js, from client-side code that can't
// hold the API key itself.
export function getTourSchedules(tourId) {
  return apiFetch(`/tours/${tourId}/schedules`);
}

// The calendar dates a tour is actually offered on. Bookings require a
// tour_date_id (not a free-typed date), so the frontend needs to resolve
// available dates before a booking can be submitted — mirrors
// getTourSchedules above.
export function getTourDates(tourId) {
  return apiFetch(`/tours/${tourId}/dates`);
}

// Remaining spots for a specific tour + date + departure time. Best-effort
// hint for the UI — the real enforcement happens server-side when
// POST /bookings is submitted. Takes dateId (a tour_dates row id), matching
// what the backend's /tours/:id/availability endpoint actually requires.
export function getTourAvailability(tourId, { dateId, scheduleId }) {
  const params = new URLSearchParams({ dateId, scheduleId });
  return apiFetch(`/tours/${tourId}/availability?${params.toString()}`);
}

// --- Reviews ---

export async function getRandomReviews({ count = 5, tourId, minStars, withContentOnly = true } = {}) {
  const params = new URLSearchParams();
  params.set('count', String(count));
  if (tourId) params.set('tourId', tourId);
  if (minStars !== undefined) params.set('minStars', String(minStars));
  params.set('withContentOnly', String(withContentOnly));

  const data = await apiFetch(`/reviews/random?${params.toString()}`);
  return data.reviews;
}

export function getTourReviews(tourId, { limit = 20, offset = 0, stars } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (stars !== undefined) params.set('stars', String(stars));
  return apiFetch(`/tours/${tourId}/reviews?${params.toString()}`);
}

// Every review for a tour, not just one page. The API caps a single page
// at 100, so this pages through until a page comes back shorter than
// requested — that's the signal there's nothing left to fetch.
export async function getAllTourReviews(tourId) {
  const pageSize = 100;
  let offset = 0;
  let all = [];

  while (true) {
    const page = await getTourReviews(tourId, { limit: pageSize, offset });
    all = all.concat(page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

export function getTourReviewSummary(tourId) {
  return apiFetch(`/tours/${tourId}/reviews/summary`);
}

export function createReview(tourId, data) {
  return apiFetch(`/tours/${tourId}/reviews`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// --- Customers ---

export function createCustomer(data) {
  return apiFetch('/customers', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// --- Bookings ---
// Tours are free — a booking is created directly and confirmed by email
// (see the backend's mailer plugin). There is no checkout/payment step.

export function createBooking(data) {
  return apiFetch('/bookings', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function getBooking(id) {
  return apiFetch(`/bookings/${id}`);
}

// --- Auth (no passwords, no confirmation codes) ---
// /auth/register creates the customer and returns a session token
// immediately. /auth/login only needs the email on file.

export function registerCustomer({ email, fullName, phone }) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, fullName, phone })
  });
}

export function loginCustomer({ email }) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

// Resolves the customer for a session token by asking the backend to
// verify the JWT itself (via /auth/me) — the frontend never needs to know
// JWT_SECRET, it just forwards the Bearer token.
export function getCurrentCustomer(token) {
  return apiFetch('/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

// ============================================================================
// Add these to the "--- Bookings ---" section of src/lib/api.js, right after
// getBooking(id).
//
// Both require the customer's own session token (Bearer auth) — the backend
// verifies request.user.sub === booking.customer_id itself (see
// src/routes/bookings.js), so these just need to forward the token.
//
// updateBooking's `data` should use the backend's exact (camelCase) field
// names — any subset of:
//   { tourDateId, tourScheduleId, quantity, numberOfChildren, numberOfBabies }
// ============================================================================

export function updateBooking(id, data, token) {
  return apiFetch(`/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    headers: { Authorization: `Bearer ${token}` }
  });
}

// Soft-cancel (DELETE /bookings/:id — the backend flips status to
// "cancelled" rather than removing the row).
export function cancelBooking(id, token) {
  return apiFetch(`/bookings/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}