import { uploadImage, AdminApiError } from "@/lib/adminApi.js";

export const prerender = false;

export async function POST({ request }) {
  try {
    const incoming = await request.formData();
    const file = incoming.get("file");

    if (!file || typeof file === "string") {
      return json({ error: "Bad Request", message: "No se ha proporcionado ningún archivo." }, 400);
    }

    const outgoing = new FormData();
    outgoing.set("file", file, file.name);
    const alt = incoming.get("alt");
    if (alt) outgoing.set("alt", alt);

    const image = await uploadImage(outgoing);
    return json(image, 201);
  } catch (err) {
    const status = err instanceof AdminApiError ? err.status : 500;
    const message = err instanceof AdminApiError ? err.message : "No se ha podido subir la imagen.";
    return json({ error: "Error", message }, status);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}