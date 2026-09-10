import { query } from "./_generated/server";
import { v } from "convex/values";
import { pesoProbatorio } from "./prelacion";

/**
 * Alegado vs. documentado.
 *
 * Puramente mecánico y determinista: cruza lo que afirma la contraparte en su
 * demanda contra lo que consta en los documentos del cliente. No hay modelo de
 * lenguaje en esta pantalla, y no debe haberlo: es aritmética y comparación de
 * cadenas, con la foja de cada dato a la vista.
 */

/** Documentos que hablan por la contraparte. El resto documenta al cliente. */
const DE_CONTRAPARTE = ["Demanda"];

/** Sólo estos datos se cruzan; el resto no admite comparación mecánica. */
const COMPARABLES: Array<{ clave: string; etiqueta: string; numerico: boolean }> = [
  { clave: "salarioDiario", etiqueta: "Salario diario", numerico: true },
  { clave: "fechaBaja", etiqueta: "Fecha de separación", numerico: false },
  { clave: "causaSeparacion", etiqueta: "Causa de la separación", numerico: false },
  { clave: "fechaIngreso", etiqueta: "Fecha de ingreso", numerico: false },
  { clave: "jornada", etiqueta: "Jornada", numerico: false },
];

function diasEntre(a: string, b: string): number | null {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return Math.round(Math.abs(ta - tb) / 86_400_000);
}

export const list = query({
  args: { expedienteId: v.id("expedientes") },
  handler: async (ctx, { expedienteId }) => {
    const documentos = await ctx.db
      .query("documentos")
      .withIndex("by_expediente", (q) => q.eq("expedienteId", expedienteId))
      .collect();

    const campos = await ctx.db
      .query("campos")
      .withIndex("by_expediente", (q) => q.eq("expedienteId", expedienteId))
      .collect();

    const porId = new Map(documentos.map((d) => [d._id, d]));

    // Un campo vacío o sin confirmar no entra al cruce: contradecir con un dato
    // que nadie validó produce una tabla que no se puede llevar a un escrito.
    const utiles = campos.filter(
      (c) => c.valor.trim() !== "" && (c.estado === "Confirmado" || c.estado === "Corregido"),
    );

    const filas = [];

    for (const comparable of COMPARABLES) {
      const delClave = utiles.filter((c) => c.clave === comparable.clave);

      const alegado = delClave.find((c) =>
        DE_CONTRAPARTE.includes(porId.get(c.documentoId)?.tipo ?? ""),
      );
      const documentado = delClave
        .filter((c) => !DE_CONTRAPARTE.includes(porId.get(c.documentoId)?.tipo ?? ""))
        .sort((a, b) => pesoProbatorio(porId.get(a.documentoId)?.tipo ?? "") - pesoProbatorio(porId.get(b.documentoId)?.tipo ?? ""))
        [0];

      if (!alegado || !documentado) continue;
      if (alegado.valor.trim() === documentado.valor.trim()) continue;

      const docFuente = porId.get(documentado.documentoId);
      let delta = "—";

      if (comparable.numerico) {
        const a = Number(alegado.valor.replace(/,/g, ""));
        const d = Number(documentado.valor.replace(/,/g, ""));
        if (Number.isFinite(a) && Number.isFinite(d) && d !== 0) {
          delta = `${(a / d).toFixed(2)}×`;
        }
      } else {
        const dias = diasEntre(alegado.valor, documentado.valor);
        if (dias !== null) delta = dias === 1 ? "1 día" : `${dias} días`;
      }

      filas.push({
        dato: comparable.etiqueta,
        alegado: alegado.valor,
        documentado: documentado.valor,
        delta,
        fuenteDocumentoId: documentado.documentoId,
        fuenteNombre: docFuente
          ? `${String(docFuente.consecutivo).padStart(2, "0")}.- ${docFuente.nombre}`
          : "documento",
        fuentePagina: documentado.pagina,
      });
    }

    // Distinguir "cero contradicciones" de "todavía no hay con qué comparar":
    // son estados distintos y el sistema jamás los confunde. La condición mira
    // los campos confirmados, no el estado del documento, porque es lo que el
    // cruce realmente consume.
    const claves = COMPARABLES.map((c) => c.clave);
    const hayAlegado = utiles.some(
      (c) => claves.includes(c.clave) && DE_CONTRAPARTE.includes(porId.get(c.documentoId)?.tipo ?? ""),
    );
    const hayDocumentado = utiles.some(
      (c) => claves.includes(c.clave) && !DE_CONTRAPARTE.includes(porId.get(c.documentoId)?.tipo ?? ""),
    );

    return {
      filas,
      ejecutado: hayAlegado && hayDocumentado,
      motivo: hayAlegado
        ? hayDocumentado
          ? null
          : "No hay datos confirmados en los documentos del cliente con qué contrastar la demanda."
        : "Ningún dato comparable de la demanda está confirmado; sin ellos no hay 'alegado' que cruzar.",
    };
  },
});
