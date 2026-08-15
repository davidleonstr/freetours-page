import { defineMiddleware } from "astro:middleware";
import { isAdminAuthenticated } from "@/lib/adminSession.js";

// Guards the admin panel and its API routes with a real login page
// (src/pages/admin/login.astro) instead of the browser's Basic Auth prompt.
// Set ADMIN_USER / ADMIN_PASSWORD server-side (not PUBLIC_-prefixed) — an
// optional ADMIN_SESSION_SECRET is used to sign the session cookie, see
// src/lib/adminSession.js. This is a minimal gate, not a replacement for a
// real auth system — swap it out if the project already has one.
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const isLoginPage = pathname === "/admin/login";
  const isLoginApi = pathname === "/api/admin/login";
  const isAdminApiRoute = pathname.startsWith("/api/admin");
  const isAdminPageRoute = pathname.startsWith("/admin");

  const needsAuth = (isAdminApiRoute || isAdminPageRoute) && !isLoginPage && !isLoginApi;

  if (!needsAuth) {
    return next();
  }

  const adminUser = import.meta.env.ADMIN_USER;
  const adminPassword = import.meta.env.ADMIN_PASSWORD;

  if (!adminUser || !adminPassword) {
    return new Response(
      "El panel de administración no está configurado (faltan ADMIN_USER / ADMIN_PASSWORD).",
      { status: 500 }
    );
  }

  if (isAdminAuthenticated(context.cookies)) {
    return next();
  }

  // API calls get a plain 401 so the page's own fetch() error handling can
  // show a message; full page loads get redirected to the login form.
  if (isAdminApiRoute) {
    return new Response(JSON.stringify({ message: "No has iniciado sesión como administrador." }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const redirectTo = `/admin/login?redirect=${encodeURIComponent(pathname + context.url.search)}`;
  return context.redirect(redirectTo);
});