import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  CAMPOS_CRITICOS,
  UMBRAL_CONFIANZA,
  type TipoDocumento,
} from "./dominio";

/**
 * PIPELINE DE INGESTA — SIMULADO.
 *
 * Esta es la única pieza del backend que hace de cuenta que hay un modelo.
 * Todo lo demás (contradicciones, cumplimiento, plazos) es código determinista.
 *
 * En producción cada etapa es un estado de una Step Function: normalizar a
 * texto con un adaptador por formato, clasificar, extraer campos con confianza
 * y dejar el documento esperando validación humana. Aquí las etapas son
 * mutaciones internas encadenadas con el scheduler de Convex: mismos estados,
 * mismas transiciones, misma observabilidad en la UI, sin costo de inferencia.
 *
 * Sustituir esto por lo real significa cambiar el cuerpo de `avanzar` por
 * llamadas a Textract/Bedrock. Los estados y la tabla `campos` no se mueven.
 */

/** Hash estable del nombre del archivo: la "aleatoriedad" es reproducible. */
function semilla(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function extension(nombre: string): string {
  const punto = nombre.lastIndexOf(".");
  return punto === -1 ? "" : nombre.slice(punto + 1).toLowerCase();
}

/**
 * Detectar si el PDF trae capa de texto ANTES de mandarlo a OCR: la mitad no lo
 * necesita y el OCR es la parte cara y lenta del pipeline.
 */
function requiereOcr(nombre: string): boolean {
  const ext = extension(nombre);
  if (["jpg", "jpeg", "png", "tif", "tiff"].includes(ext)) return true;
  if (ext !== "pdf") return false;
  const n = nombre.toLowerCase();
  if (n.includes("escanea") || n.includes("scan")) return true;
  return semilla(nombre) % 3 === 0;
}

function adaptador(nombre: string): string {
  switch (extension(nombre)) {
    case "md":
      return "Markdown · parseo directo";
    case "docx":
      return "DOCX · extracción de XML";
    case "doc":
      return "DOC · conversión previa a DOCX";
    case "pdf":
      return requiereOcr(nombre)
        ? "PDF escaneado · sin capa de texto"
        : "PDF con capa de texto · extracción directa";
    case "jpg":
    case "jpeg":
    case "png":
    case "tif":
    case "tiff":
      return "Imagen · requiere OCR";
    default:
      return "Formato no soportado";
  }
}

const FORMATOS = ["md", "doc", "docx", "pdf", "jpg", "jpeg", "png", "tif", "tiff"];

/** Clasificación por nombre; en producción la hace el modelo sobre el texto. */
function clasificar(nombre: string): { tipo: TipoDocumento; confianza: number } {
  const n = nombre.toLowerCase();
  const reglas: Array<[RegExp, TipoDocumento]> = [
    [/demanda|escrito inicial/, "Demanda"],
    [/contesta/, "Contestación"],
    [/contrato|individual/, "Contrato individual"],
    [/n[oó]mina|recibo|cfdi|raya/, "Recibo de nómina"],
    [/rescis|aviso/, "Aviso de rescisión"],
    [/asistencia|checador|reloj/, "Control de asistencia"],
    [/poder|notarial/, "Poder notarial"],
    [/ine|pasaporte|identifica|credencial/, "Identificación"],
    [/prueba|anexo|documental/, "Prueba documental"],
  ];

  for (const [patron, tipo] of reglas) {
    if (patron.test(n)) return { tipo, confianza: 0.88 + (semilla(nombre) % 11) / 100 };
  }
  return { tipo: "Sin clasificar", confianza: 0.41 };
}

interface CampoExtraido {
  clave: string;
  etiqueta: string;
  valor: string;
  confianza: number;
  pagina: number;
}

/**
 * Campos que cada tipo de documento aporta. Los valores de la demanda y los de
 * la nómina divergen a propósito: de ese cruce sale la tabla de
 * contradicciones, que es el entregable de mayor valor de la fase 1.
 */
function extraer(tipo: TipoDocumento, nombre: string): CampoExtraido[] {
  const s = semilla(nombre);
  // Jitter reproducible sobre la confianza, para que la pantalla de validación
  // muestre campos por arriba y por debajo del umbral.
  const j = (n: number) => Math.min(0.99, Math.max(0.4, n + ((s % 13) - 6) / 100));

  switch (tipo) {
    case "Demanda":
      return [
        { clave: "numeroExpediente", etiqueta: "Número de expediente", valor: "1146/2022", confianza: j(0.94), pagina: 1 },
        { clave: "autoridad", etiqueta: "Autoridad que conoce", valor: "Junta Especial 30 Federal", confianza: j(0.91), pagina: 1 },
        { clave: "actor", etiqueta: "Parte actora", valor: "Michel Lara Vega", confianza: j(0.96), pagina: 1 },
        { clave: "demandado", etiqueta: "Parte demandada", valor: "Frunatural S.A. de C.V.", confianza: j(0.95), pagina: 1 },
        { clave: "fechaIngreso", etiqueta: "Fecha de ingreso alegada", valor: "2015-03-16", confianza: j(0.82), pagina: 2 },
        { clave: "fechaBaja", etiqueta: "Fecha de separación alegada", valor: "2018-09-01", confianza: j(0.86), pagina: 2 },
        { clave: "salarioDiario", etiqueta: "Salario diario alegado", valor: "400.00", confianza: j(0.79), pagina: 2 },
        { clave: "causaSeparacion", etiqueta: "Causa alegada", valor: "Despido injustificado", confianza: j(0.88), pagina: 3 },
        { clave: "jornada", etiqueta: "Jornada alegada", valor: "Lunes a sábado, 08:00 a 19:00", confianza: j(0.68), pagina: 3 },
        { clave: "prestaciones", etiqueta: "Prestaciones reclamadas", valor: "Indemnización constitucional, salarios vencidos, prima de antigüedad, vacaciones, prima vacacional y aguinaldo", confianza: j(0.9), pagina: 4 },
        { clave: "montoReclamado", etiqueta: "Monto total reclamado", valor: "486,320.00", confianza: j(0.71), pagina: 5 },
      ];

    case "Recibo de nómina":
      return [
        { clave: "salarioDiario", etiqueta: "Salario diario", valor: "120.00", confianza: j(0.97), pagina: 1 },
        { clave: "periodoPago", etiqueta: "Periodo de pago", valor: "16 al 31 de agosto de 2018", confianza: j(0.93), pagina: 1 },
        { clave: "fechaBaja", etiqueta: "Fecha de baja registrada", valor: "2018-08-31", confianza: j(0.9), pagina: 2 },
        { clave: "causaSeparacion", etiqueta: "Motivo de baja registrado", valor: "Separación voluntaria", confianza: j(0.84), pagina: 2 },
        { clave: "uuidCfdi", etiqueta: "UUID del CFDI", valor: "A1C4E9F2-77B0-4D31-9C88-2E51B0A7D410", confianza: j(0.99), pagina: 1 },
      ];

    case "Contrato individual":
      return [
        { clave: "fechaIngreso", etiqueta: "Fecha de ingreso", valor: "2015-03-16", confianza: j(0.95), pagina: 1 },
        { clave: "salarioDiario", etiqueta: "Salario diario pactado", valor: "112.00", confianza: j(0.89), pagina: 1 },
        { clave: "puesto", etiqueta: "Puesto", valor: "Auxiliar de producción", confianza: j(0.92), pagina: 1 },
        { clave: "jornada", etiqueta: "Jornada pactada", valor: "Lunes a viernes, 08:00 a 17:00", confianza: j(0.87), pagina: 2 },
        { clave: "duracion", etiqueta: "Duración", valor: "Tiempo indeterminado", confianza: j(0.94), pagina: 1 },
      ];

    case "Aviso de rescisión":
      return [
        { clave: "fechaAviso", etiqueta: "Fecha del aviso", valor: "2018-08-31", confianza: j(0.93), pagina: 1 },
        { clave: "causaSeparacion", etiqueta: "Causa invocada", valor: "Faltas de asistencia injustificadas", confianza: j(0.86), pagina: 1 },
        { clave: "constanciaEntrega", etiqueta: "Constancia de entrega", valor: "Negativa del trabajador a recibir", confianza: j(0.62), pagina: 2 },
      ];

    case "Control de asistencia":
      return [
        { clave: "periodoControl", etiqueta: "Periodo cubierto", valor: "1 de julio al 31 de agosto de 2018", confianza: j(0.91), pagina: 1 },
        { clave: "faltas", etiqueta: "Faltas registradas", valor: "6 en el último mes", confianza: j(0.74), pagina: 3 },
      ];

    case "Contestación":
      return [
        { clave: "numeroExpediente", etiqueta: "Número de expediente", valor: "1146/2022", confianza: j(0.93), pagina: 1 },
        { clave: "fechaNotificacion", etiqueta: "Fecha de notificación", valor: "2022-06-14", confianza: j(0.81), pagina: 1 },
        { clave: "excepciones", etiqueta: "Excepciones opuestas", valor: "Prescripción, falta de acción y de derecho", confianza: j(0.85), pagina: 2 },
      ];

    case "Poder notarial":
      return [
        { clave: "escritura", etiqueta: "Número de escritura", valor: "42,317", confianza: j(0.96), pagina: 1 },
        { clave: "notario", etiqueta: "Notario", valor: "Lic. Ramón Ortega Sáenz, Notaría 14 de Morelia", confianza: j(0.9), pagina: 1 },
        { clave: "apoderados", etiqueta: "Apoderados", valor: "Isacc Alfonso Ávila Miranda y otros", confianza: j(0.88), pagina: 2 },
      ];

    case "Identificación":
      return [
        { clave: "nombreTitular", etiqueta: "Nombre del titular", valor: "Michel Lara Vega", confianza: j(0.94), pagina: 1 },
        { clave: "curp", etiqueta: "CURP", valor: "LAVM880412HMNRGC08", confianza: j(0.77), pagina: 1 },
      ];

    default:
      return [
        { clave: "fechaDocumento", etiqueta: "Fecha del documento", valor: "2018-08-31", confianza: j(0.66), pagina: 1 },
        { clave: "resumen", etiqueta: "Resumen del contenido", valor: "Documento sin tipo reconocido; requiere clasificación manual.", confianza: j(0.52), pagina: 1 },
      ];
  }
}

/** Región normalizada sobre la página, para resaltar el campo en la imagen. */
function region(clave: string, indice: number) {
  const s = semilla(clave);
  return {
    x: 0.08 + (s % 12) / 100,
    y: 0.12 + ((indice * 11) % 62) / 100,
    ancho: 0.32 + (s % 30) / 100,
    alto: 0.045,
  };
}

async function bitacora(
  ctx: MutationCtx,
  expedienteId: Id<"expedientes">,
  evento: string,
  detalle: string,
) {
  await ctx.db.insert("bitacora", {
    expedienteId,
    evento,
    detalle,
    en: new Date().toISOString(),
  });
}

/** Ritmo del pipeline simulado. Suficiente para verse en pantalla, no para aburrir. */
const RITMO_MS = 1400;

export const avanzar = internalMutation({
  args: { documentoId: v.id("documentos"), etapa: v.number() },
  handler: async (ctx, { documentoId, etapa }) => {
    const doc = await ctx.db.get(documentoId);
    // El documento pudo borrarse mientras el pipeline corría: no es un error.
    if (!doc) return;

    const ocr = requiereOcr(doc.nombre);

    switch (etapa) {
      case 0: {
        if (!FORMATOS.includes(extension(doc.nombre))) {
          await ctx.db.patch(documentoId, {
            estado: "Error",
            paso: "Formato no soportado",
            error: `No hay adaptador para «.${extension(doc.nombre) || "sin extensión"}». El original se conserva íntegro.`,
          });
          await bitacora(ctx, doc.expedienteId, "Ingesta fallida", doc.nombre);
          return;
        }
        await ctx.db.patch(documentoId, {
          estado: "Normalizando",
          paso: adaptador(doc.nombre),
          requiereOcr: ocr,
        });
        break;
      }

      case 1: {
        // El OCR es el tramo caro; se anuncia como tal en la UI.
        const paginas = 2 + (semilla(doc.nombre) % 7);
        await ctx.db.patch(documentoId, {
          estado: "Clasificando",
          paso: ocr
            ? `OCR completado · ${paginas} páginas reconocidas`
            : `Texto extraído · ${paginas} páginas`,
          paginas,
        });
        break;
      }

      case 2: {
        const { tipo, confianza } = clasificar(doc.nombre);
        await ctx.db.patch(documentoId, {
          estado: "Extrayendo",
          // El tipo propuesto es editable: la clasificación no es una sentencia.
          tipo,
          paso:
            tipo === "Sin clasificar"
              ? "Sin tipo reconocido · requiere clasificación manual"
              : `Clasificado como ${tipo} · confianza ${(confianza * 100).toFixed(0)}%`,
        });
        break;
      }

      case 3: {
        const campos = extraer(doc.tipo, doc.nombre);
        for (const [indice, campo] of campos.entries()) {
          const critico = CAMPOS_CRITICOS.includes(campo.clave);
          // Bajo el umbral: el campo entra VACÍO y marcado. Nunca se rellena
          // con una estimación, porque un dato inventado es peor que ninguno.
          const bajo = campo.confianza < UMBRAL_CONFIANZA;
          await ctx.db.insert("campos", {
            expedienteId: doc.expedienteId,
            documentoId,
            clave: campo.clave,
            etiqueta: campo.etiqueta,
            valor: bajo ? "" : campo.valor,
            confianza: campo.confianza,
            critico,
            estado: bajo ? "Vacío" : "Pendiente",
            pagina: campo.pagina,
            region: region(campo.clave, indice),
          });
        }

        const porDebajo = campos.filter((c) => c.confianza < UMBRAL_CONFIANZA).length;
        await ctx.db.patch(documentoId, {
          estado: "Por validar",
          paso:
            porDebajo === 0
              ? `${campos.length} campos extraídos · esperando validación`
              : `${campos.length} campos extraídos · ${porDebajo} bajo el umbral`,
        });
        await bitacora(
          ctx,
          doc.expedienteId,
          "Documento procesado",
          `${doc.nombre} · ${campos.length} campos extraídos`,
        );
        return;
      }

      default:
        return;
    }

    await ctx.scheduler.runAfter(RITMO_MS, internal.ia.avanzar, {
      documentoId,
      etapa: etapa + 1,
    });
  },
});

/** Reprocesar: borra la extracción anterior y vuelve a correr el pipeline. */
export const reiniciar = internalMutation({
  args: { documentoId: v.id("documentos") },
  handler: async (ctx, { documentoId }) => {
    const previos = await ctx.db
      .query("campos")
      .withIndex("by_documento", (q) => q.eq("documentoId", documentoId))
      .collect();
    for (const campo of previos) await ctx.db.delete(campo._id);

    await ctx.db.patch(documentoId, {
      estado: "Recibido",
      paso: "En cola para reprocesar",
      error: undefined,
    });
    await ctx.scheduler.runAfter(600, internal.ia.avanzar, { documentoId, etapa: 0 });
  },
});
