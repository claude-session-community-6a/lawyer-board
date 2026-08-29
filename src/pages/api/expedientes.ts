import type { APIRoute } from "astro";

import {
  createExpediente,
  listExpedientes,
  type DocumentoExpediente,
  type Materia,
} from "@/lib/expedientes";

export const prerender = false;

interface Payload {
  numero?: string;
  caratula?: string;
  materia?: Materia;
  juzgado?: string;
  actor?: string;
  demandado?: string;
  cliente?: string;
  documentos?: Array<Pick<DocumentoExpediente, "nombre" | "tipo" | "tamanoBytes">>;
}

export const GET: APIRoute = () => Response.json(listExpedientes());

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json()) as Payload;
  const faltantes = (["numero", "caratula", "cliente"] as const).filter(
    (campo) => !body[campo]?.trim()
  );

  if (faltantes.length > 0) {
    return Response.json(
      { error: `Campos requeridos: ${faltantes.join(", ")}.` },
      { status: 400 }
    );
  }

  const subidoEn = new Date().toISOString();
  const expediente = createExpediente({
    numero: body.numero!.trim(),
    caratula: body.caratula!.trim(),
    materia: body.materia ?? "Civil",
    juzgado: body.juzgado?.trim() ?? "",
    actor: body.actor?.trim() ?? "",
    demandado: body.demandado?.trim() ?? "",
    cliente: body.cliente!.trim(),
    documentos: (body.documentos ?? []).map((documento, index) => ({
      id: `doc-${Date.now()}-${index}`,
      nombre: documento.nombre,
      tipo: documento.tipo,
      tamanoBytes: documento.tamanoBytes,
      subidoEn,
    })),
  });

  return Response.json(expediente, { status: 201 });
};
