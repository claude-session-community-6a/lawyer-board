import type { APIRoute } from "astro";
import { PUBLIC_CONVEX_URL } from "astro:env/client";
import { ConvexHttpClient } from "convex/browser";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

export const prerender = false;

const MARGEN = 64;
const ANCHO = 612; // Carta, en puntos.
const ALTO = 792;

/**
 * Las fuentes estándar de PDF codifican WinAnsi. El español cabe entero, pero
 * un carácter fuera del juego reventaría la escritura, así que se sustituye lo
 * conocido y se descarta el resto en lugar de fallar la exportación.
 */
function aWinAnsi(texto: string): string {
  return texto
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[‒–]/g, "-")
    .replace(/ /g, " ")
    .replace(/[^\x00-\xFF]/g, "");
}

/** Corte de línea por ancho real de glifo, no por número de caracteres. */
function envolver(
  texto: string,
  fuente: { widthOfTextAtSize: (t: string, s: number) => number },
  tamano: number,
  ancho: number,
): string[] {
  const lineas: string[] = [];

  for (const parrafo of texto.split("\n")) {
    if (parrafo.trim() === "") {
      lineas.push("");
      continue;
    }

    let actual = "";
    for (const palabra of parrafo.split(/\s+/)) {
      const tentativa = actual === "" ? palabra : `${actual} ${palabra}`;
      if (fuente.widthOfTextAtSize(tentativa, tamano) > ancho && actual !== "") {
        lineas.push(actual);
        actual = palabra;
      } else {
        actual = tentativa;
      }
    }
    if (actual !== "") lineas.push(actual);
  }

  return lineas;
}

export const GET: APIRoute = async ({ params }) => {
  const id = params.id as Id<"escritos"> | undefined;
  if (!id) return new Response("Falta el identificador del escrito.", { status: 400 });

  const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);

  const [escrito, validacion] = await Promise.all([
    convex.query(api.escritos.get, { id }),
    convex.query(api.escritos.validarCitas, { id }),
  ]);

  if (!escrito || !validacion) {
    return new Response("Ese escrito no existe.", { status: 404 });
  }

  // La compuerta vive en el servidor, no sólo en el botón: un escrito con un
  // supuesto o con una cita que no verifica NO sale de aquí, se pida como se pida.
  if (!validacion.puedeExportar) {
    return Response.json(
      {
        error: "El escrito no pasa la compuerta de exportación.",
        bloqueos: validacion.bloqueos,
      },
      { status: 409 },
    );
  }

  const expediente = await convex.query(api.expedientes.get, {
    id: escrito.expedienteId,
  });
  if (!expediente) return new Response("El expediente no existe.", { status: 404 });

  const pdf = await PDFDocument.create();
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifNegrita = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const anchoUtil = ANCHO - MARGEN * 2;

  let pagina = pdf.addPage([ANCHO, ALTO]);
  let y = ALTO - MARGEN;

  const salto = (alto: number) => {
    if (y - alto < MARGEN) {
      pagina = pdf.addPage([ANCHO, ALTO]);
      y = ALTO - MARGEN;
    }
  };

  const escribir = (
    texto: string,
    opciones: { tamano?: number; negrita?: boolean; interlineado?: number; gris?: boolean } = {},
  ) => {
    const tamano = opciones.tamano ?? 11;
    const fuente = opciones.negrita ? serifNegrita : serif;
    const alto = tamano * (opciones.interlineado ?? 1.45);

    for (const linea of envolver(aWinAnsi(texto), fuente, tamano, anchoUtil)) {
      salto(alto);
      if (linea !== "") {
        pagina.drawText(linea, {
          x: MARGEN,
          y: y - tamano,
          size: tamano,
          font: fuente,
          color: opciones.gris ? rgb(0.42, 0.42, 0.45) : rgb(0.1, 0.1, 0.12),
        });
      }
      y -= alto;
    }
  };

  // Membrete: la identidad del asunto viaja en el papel, igual que en pantalla.
  escribir(expediente.cliente.toUpperCase(), { tamano: 9, negrita: true, gris: true });
  escribir(
    `Expediente ${expediente.numero} · ${expediente.autoridadTipo} ${expediente.fuero} · ${expediente.plaza}`,
    { tamano: 9, gris: true },
  );
  escribir(
    `Régimen ${expediente.regimen} · Lado ${expediente.lado} · Hechos ${expediente.fechaHechos}`,
    { tamano: 9, gris: true },
  );

  y -= 10;
  salto(20);
  pagina.drawLine({
    start: { x: MARGEN, y },
    end: { x: ANCHO - MARGEN, y },
    thickness: 0.75,
    color: rgb(0.8, 0.8, 0.82),
  });
  y -= 22;

  escribir(escrito.titulo.toUpperCase(), { tamano: 14, negrita: true });
  escribir(expediente.caratula, { tamano: 10, gris: true });
  y -= 12;

  for (const seccion of escrito.secciones) {
    y -= 8;
    escribir(seccion.nombre.toUpperCase(), { tamano: 10, negrita: true });
    escribir(seccion.contenido, { tamano: 11 });

    if (seccion.citas.length > 0) {
      escribir(
        `Fundamento verificado: ${seccion.citas.map((a) => `LFT art. ${a}`).join(", ")}.`,
        { tamano: 8, gris: true },
      );
    }
  }

  y -= 24;
  escribir(
    "Este documento fue generado con asistencia de la plataforma y revisado por el abogado que lo suscribe. Todas las citas normativas fueron verificadas contra el texto indexado en la vigencia de la fecha de los hechos.",
    { tamano: 8, gris: true },
  );

  const bytes = await pdf.save();
  const archivo = `${expediente.numero.replace(/\//g, "-")} ${escrito.titulo}.pdf`;
  // Las cabeceras HTTP son ASCII: el nombre acentuado viaja en `filename*`.
  const ascii = archivo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");

  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(archivo)}`,
      "Cache-Control": "no-store",
    },
  });
};
