# Tours Meriyo Dublín

An [Astro](https://astro.build) frontend for a **free walking-tours** booking site — think GuruWalk/Sandemans-style "free tour" model: no prices, no checkout, no payment processing. Visitors browse a tour catalog, pick a date and departure time, and book instantly. A lightweight admin panel manages the catalog behind a real login page.

This repo is the frontend only — it talks to a separate backend API (tours, bookings, customers, reviews) over HTTP.

## What it does

- **Browse tours** — catalog grid with cover photos (pulled from each tour's gallery), descriptions, duration, and capacity.
- **Book a free tour** — pick one of the tour's open calendar dates and one of its departure times, enter party size (adults / children / babies / pets), and submit. Availability is checked against remaining capacity for that specific date + time before the booking is confirmed.
- **Manage a booking** — view, edit, or cancel (soft-cancel) an existing booking at `/mi-reserva/[id]`.
- **Download a booking confirmation as PDF** — a styled, on-brand PDF (built with `pdf-lib`, no headless browser) with the tour, date/time, party details, a "view on Google Maps" button for the meeting point, and links back to the live booking page.
- **Leave a review** — one review (1–5 stars + optional text) per tour; the public site can also show a random sampling of reviews site-wide.
- **Admin panel** (`/admin`) — create/edit/archive tours, manage each tour's departure times and calendar dates, upload and assign a cover image. Protected by a real login page instead of a browser Basic Auth prompt.

## How it's put together

### Public site → backend
`src/lib/api.js` is the **server-only** client for the public-facing backend endpoints (tours, schedules, dates, availability, reviews, bookings, auth). It's used from Astro frontmatter and from `src/pages/api/*` routes — never from client `<script>` tags, since it holds the API key.

Some of those endpoints are re-exposed as same-origin routes under `src/pages/api/` (e.g. `api/tours/[id]/schedules.js`, `api/tours/[id]/dates.js`, `api/tours/[id]/availability.js`) purely so client-side JavaScript — which can't hold `API_KEY` — has something to call.

### Bookings
- `src/pages/api/bookings.ts` — creates a booking, with Spanish-language, capacity-aware error messages (404 tour gone, 409 sold out with remaining-spots count, etc.).
- `src/pages/api/bookings/[id].js` — update/cancel a booking.
- `src/pages/mi-reserva/[id]/pdf.ts` — generates the booking-confirmation PDF on the fly.

### Admin panel
- `src/middleware.js` — gates every `/admin` page and `/api/admin/*` route. Full page loads redirect to `/admin/login`; API calls get a plain `401` so the page's own error handling can show it.
- `src/lib/adminSession.js` — signs a short-lived (8h), HMAC-signed session cookie for the single admin account (`ADMIN_USER` / `ADMIN_PASSWORD`), with basic brute-force rate limiting on `/api/admin/login`.
- `src/lib/adminApi.js` — server-only client for the *write* side of the API (needs `API_KEY` + `PUBLISH_KEY`). Covers tours (list/create/update/archive — archiving deactivates rather than deletes, since bookings reference the row), gallery/cover image management, and per-tour schedules and dates.
- `src/pages/api/admin/**` — REST-ish proxy routes the admin UI calls (tours, `[id]`, cover-image, dates, schedules, and their nested `[id]` delete routes).

### UI helper
- `src/lib/confirmDialog.js` — a promise-based `confirmDialog({...})` used in place of `window.confirm()`, wired to a shared `<ConfirmDialog />` component so destructive actions (archiving a tour, deleting a date/schedule) get a styled prompt instead of the native browser dialog.

## Environment variables

Set these server-side only (**no** `PUBLIC_` prefix — they must never reach the browser):

| Variable | Used by | Notes |
|---|---|---|
| `API_BASE_URL` | `lib/api.js`, `lib/adminApi.js` | Base URL of the backend API |
| `API_KEY` | `lib/api.js`, `lib/adminApi.js` | Read access to the backend |
| `PUBLISH_KEY` | `lib/adminApi.js` | Required in addition to `API_KEY` for write operations (create/update/archive tour, manage gallery/schedules/dates) |
| `ADMIN_USER` / `ADMIN_PASSWORD` | `middleware.js`, `lib/adminSession.js`, `api/admin/login.ts` | Single admin account credentials |
| `ADMIN_SESSION_SECRET` | `lib/adminSession.js` | Signs the admin session cookie; falls back to `ADMIN_PASSWORD` if unset (fine for a single-admin setup, but a dedicated secret is recommended) |

## Project structure

```
src/
  middleware.js              -- guards /admin pages + /api/admin routes
  lib/
    api.js                   -- server-only client: public backend endpoints
    adminApi.js              -- server-only client: admin/write endpoints
    adminSession.js           -- signed admin session cookie helpers
    confirmDialog.js           -- confirm()-replacement dialog helper
  pages/
    mi-reserva/[id]/pdf.ts    -- booking confirmation PDF
    api/
      bookings.ts             -- create a booking
      bookings/[id].js         -- update / cancel a booking
      tours/[id]/              -- schedules, dates, availability, reviews
      admin/
        login.ts / logout.ts
        images.js               -- cover image upload
        tours/                  -- CRUD + nested dates/schedules
```

## Notes for future changes

- A tour's cover photo is rendered from its **gallery** (`gallery[0]`), not the `tours.image` column — nothing in the frontend reads `tours.image` directly.
- Bookings always reference a concrete `tour_date_id` and `tour_schedule_id` rather than free-typed date/time values, so the UI needs to resolve those before a booking can be submitted.
- There's no payment step anywhere in this flow by design — these are free tours.