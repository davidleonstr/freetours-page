// Server-only helper for the admin panel. This file must never be imported
// from client-side (`<script>`) code — it reads API_KEY / PUBLISH_KEY, which
// grant write access to the catalog and must stay off the browser.
//
// Required environment variables (set these in your deploy environment /
// .env, NOT prefixed with PUBLIC_):
//   API_BASE_URL   e.g. https://api.toursmeriyodublin.com
//   API_KEY        same value as the backend's API_KEY
//   PUBLISH_KEY    same value as the backend's PUBLISH_KEY
//
// If your project already has a shared request helper in `src/lib/api.js`
// with these env vars under different names, swap the three constants below
// to reuse it instead of duplicating the fetch logic.

const API_BASE_URL = import.meta.env.API_BASE_URL;
const API_KEY = import.meta.env.API_KEY;
const PUBLISH_KEY = import.meta.env.PUBLISH_KEY;

export class AdminApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.body = body;
  }
}

function assertConfigured() {
  if (!API_BASE_URL || !API_KEY || !PUBLISH_KEY) {
    throw new Error(
      "Missing API_BASE_URL, API_KEY, or PUBLISH_KEY environment variables on the server. " +
        "Set them in your .env (server-side, not PUBLIC_-prefixed)."
    );
  }
}

// Uploads can legitimately take longer than a JSON request, but nothing
// should hang indefinitely — a misconfigured or unreachable API_BASE_URL
// should fail fast with a clear error instead of hanging for minutes.
const REQUEST_TIMEOUT_MS = 20_000;

async function adminRequest(path, { method = "GET", body, isFormData = false, needsPublishKey = false } = {}) {
  assertConfigured();

  const headers = { "x-api-key": API_KEY };
  if (needsPublishKey) headers["x-publish-key"] = PUBLISH_KEY;
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new AdminApiError(
        `No se ha podido conectar con la API en ${API_BASE_URL} (tiempo de espera agotado tras ${REQUEST_TIMEOUT_MS / 1000}s). ` +
          "Comprueba que API_BASE_URL apunta al backend correcto y que está en marcha.",
        504
      );
    }
    throw new AdminApiError(`No se ha podido conectar con la API en ${API_BASE_URL}: ${err.message}`, 502);
  } finally {
    clearTimeout(timeout);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const message = (data && data.message) || `La solicitud falló con estado ${res.status}.`;
    throw new AdminApiError(message, res.status, data);
  }

  return data;
}

// Omitting the `active` query param returns tours in every state, which is
// what the admin list needs (the public site only ever asks for active ones).
export function listAllTours() {
  return adminRequest("/tours");
}

// Manually triggers the daily reservations summary email (same job the
// midnight cron runs) — used by the "Enviar resumen ahora" button on the
// admin Reservas panel.
export function sendReservationsSummaryEmail() {
  return adminRequest("/bookings/summary/send", { method: "POST", needsPublishKey: true });
}

// --- Reservations summary (aggregated per tour/date/time, for the admin panel) ---

export function listBookingsSummary(params = {}) {
  const query = new URLSearchParams();
  if (params.tourId) query.set("tourId", params.tourId);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  if (params.timeFrom) query.set("timeFrom", params.timeFrom);
  if (params.timeTo) query.set("timeTo", params.timeTo);
  if (params.includeCancelled) query.set("includeCancelled", "true");
  const qs = query.toString();
  return adminRequest(`/bookings/summary${qs ? `?${qs}` : ""}`);
}

export function getTourById(id) {
  return adminRequest(`/tours/${id}`);
}

export function createTour(payload) {
  return adminRequest("/tours", { method: "POST", body: payload, needsPublishKey: true });
}

export function updateTour(id, payload) {
  return adminRequest(`/tours/${id}`, { method: "PATCH", body: payload, needsPublishKey: true });
}

// The backend archives (deactivates) rather than hard-deleting tours, since
// bookings reference them. This mirrors that: it does not remove the row.
export function archiveTour(id) {
  return adminRequest(`/tours/${id}`, { method: "DELETE", needsPublishKey: true });
}

export function uploadImage(formData) {
  return adminRequest("/images", { method: "POST", body: formData, isFormData: true, needsPublishKey: true });
}

// The public site renders a tour's cover photo from its *gallery*
// (Tours.astro calls getTourGallery and uses gallery[0]?.url) — not from
// the `image` field on the tours row, which nothing in the frontend reads.
// This admin panel only manages a single "featured" photo per tour, so
// setting a new cover replaces the whole gallery with just that one image
// at position 0, rather than trying to merge into a multi-photo gallery.
export async function setTourCoverImage(tourId, imageId) {
  const existing = await adminRequest(`/tours/${tourId}/gallery`);
  for (const entry of existing) {
    await adminRequest(`/tours/${tourId}/gallery/${entry.gallery_id}`, { method: "DELETE", needsPublishKey: true });
  }
  return adminRequest(`/tours/${tourId}/gallery`, {
    method: "POST",
    body: { imageId, position: 0 },
    needsPublishKey: true
  });
}

// --- Tour schedules (departure times) — bookings require a valid
// tour_schedule_id, so these need to be manageable somewhere. ---

export function listTourSchedules(tourId) {
  return adminRequest(`/tours/${tourId}/schedules`);
}

export function createTourSchedule(tourId, payload) {
  return adminRequest(`/tours/${tourId}/schedules`, { method: "POST", body: payload, needsPublishKey: true });
}

export function deleteTourSchedule(tourId, scheduleId) {
  return adminRequest(`/tours/${tourId}/schedules/${scheduleId}`, { method: "DELETE", needsPublishKey: true });
}

// --- Tour dates (calendar dates a tour is offered on) — bookings require
// a valid tour_date_id, same reasoning as schedules above. ---

export function listTourDates(tourId) {
  return adminRequest(`/tours/${tourId}/dates`);
}

export function createTourDate(tourId, payload) {
  return adminRequest(`/tours/${tourId}/dates`, { method: "POST", body: payload, needsPublishKey: true });
}

export function deleteTourDate(tourId, dateId) {
  return adminRequest(`/tours/${tourId}/dates/${dateId}`, { method: "DELETE", needsPublishKey: true });
}

// --- Tour stops (ordered route waypoints, distinct from the tour's single
// required meeting point) — each stop is pinned to a location the same way
// the meeting point is (address search + click-to-set on an OSM map). ---

export function listTourStops(tourId) {
  return adminRequest(`/tours/${tourId}/stops`);
}

export function createTourStop(tourId, payload) {
  return adminRequest(`/tours/${tourId}/stops`, { method: "POST", body: payload, needsPublishKey: true });
}

export function updateTourStop(tourId, stopId, payload) {
  return adminRequest(`/tours/${tourId}/stops/${stopId}`, { method: "PATCH", body: payload, needsPublishKey: true });
}

export function deleteTourStop(tourId, stopId) {
  return adminRequest(`/tours/${tourId}/stops/${stopId}`, { method: "DELETE", needsPublishKey: true });
}

// Reorders every stop of a tour in one call — `order` is an array of stop
// ids in the desired visiting order (every existing stop id must appear
// exactly once).
export function reorderTourStops(tourId, order) {
  return adminRequest(`/tours/${tourId}/stops/order`, { method: "PUT", body: { order }, needsPublishKey: true });
}

// --- Gallery (per-tour image ordering) ---

export function getTourGallery(tourId) {
  return adminRequest(`/tours/${tourId}/gallery`);
}

export function addImageToGallery(tourId, payload) {
  return adminRequest(`/tours/${tourId}/gallery`, { method: "POST", body: payload, needsPublishKey: true });
}

export function updateGalleryPosition(tourId, galleryId, position) {
  return adminRequest(`/tours/${tourId}/gallery/${galleryId}`, {
    method: "PATCH",
    body: { position },
    needsPublishKey: true
  });
}

export function removeImageFromGallery(tourId, galleryId) {
  return adminRequest(`/tours/${tourId}/gallery/${galleryId}`, { method: "DELETE", needsPublishKey: true });
}

// --- Images (the underlying uploaded file/row, independent of any gallery) ---

export function updateImage(imageId, payload) {
  return adminRequest(`/images/${imageId}`, { method: "PATCH", body: payload, needsPublishKey: true });
}

export function deleteImage(imageId) {
  return adminRequest(`/images/${imageId}`, { method: "DELETE", needsPublishKey: true });
}