import type { APIRoute } from "astro";

export const prerender = false;

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Skeleton upload endpoint: validates the file and reports it accepted.
 * Persisting to object storage is the next step — nothing is written yet.
 */
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const archivo = form.get("archivo");

  if (!(archivo instanceof File)) {
    return Response.json(
      { error: "Falta el campo 'archivo'." },
      { status: 400 }
    );
  }

  if (archivo.size > MAX_BYTES) {
    return Response.json(
      { error: "El archivo excede el límite de 25 MB." },
      { status: 413 }
    );
  }

  return Response.json({
    id: `upl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nombre: archivo.name,
    tamanoBytes: archivo.size,
    contentType: archivo.type,
  });
};
