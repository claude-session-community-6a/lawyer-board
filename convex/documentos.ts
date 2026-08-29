import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { tipoDocumento } from "./schema";

/** Índice del expediente digital, en el orden consecutivo de la casa. */
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

    return documentos
      .sort((a, b) => a.consecutivo - b.consecutivo)
      .map((documento) => {
        const propios = campos.filter((c) => c.documentoId === documento._id);
        return {
          ...documento,
          totalCampos: propios.length,
          camposPendientes: propios.filter((c) => c.estado !== "Confirmado" && c.estado !== "Corregido")
            .length,
        };
      });
  },
});

export const get = query({
  args: { id: v.id("documentos") },
  handler: async (ctx, { id }) => {
    const documento = await ctx.db.get(id);
    if (!documento) return null;

    const campos = await ctx.db
      .query("campos")
      .withIndex("by_documento", (q) => q.eq("documentoId", id))
      .collect();

    return { ...documento, campos };
  },
});

/**
 * Alta de un documento. Entra en `Recibido` y el pipeline se dispara solo: la
 * UI no orquesta nada, sólo observa los estados que van cayendo.
 */
export const registrar = mutation({
  args: {
    expedienteId: v.id("expedientes"),
    nombre: v.string(),
    tamanoBytes: v.number(),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const previos = await ctx.db
      .query("documentos")
      .withIndex("by_expediente", (q) => q.eq("expedienteId", args.expedienteId))
      .collect();

    const documentoId = await ctx.db.insert("documentos", {
      ...args,
      consecutivo: previos.length + 1,
      tipo: "Sin clasificar",
      subidoEn: new Date().toISOString(),
      estado: "Recibido",
      paso: "En cola",
    });

    await ctx.scheduler.runAfter(500, internal.ia.avanzar, { documentoId, etapa: 0 });

    return documentoId;
  },
});

/** La clasificación automática es una propuesta; el abogado la corrige. */
export const cambiarTipo = mutation({
  args: { id: v.id("documentos"), tipo: tipoDocumento },
  handler: async (ctx, { id, tipo }) => {
    const documento = await ctx.db.get(id);
    if (!documento) return;

    await ctx.db.patch(id, { tipo, paso: `Tipo corregido a ${tipo} por el abogado` });
    await ctx.db.insert("bitacora", {
      expedienteId: documento.expedienteId,
      evento: "Reclasificación manual",
      detalle: `${documento.nombre}: ${documento.tipo} → ${tipo}`,
      en: new Date().toISOString(),
    });
  },
});

export const reprocesar = mutation({
  args: { id: v.id("documentos") },
  handler: async (ctx, { id }) => {
    await ctx.scheduler.runAfter(0, internal.ia.reiniciar, { documentoId: id });
  },
});

/**
 * Confirmación humana campo por campo. Corregir un valor lo marca `Corregido`,
 * que es distinto de `Confirmado`: la traza tiene que saber quién puso el dato.
 */
export const guardarCampo = mutation({
  args: { id: v.id("campos"), valor: v.string() },
  handler: async (ctx, { id, valor }) => {
    const campo = await ctx.db.get(id);
    if (!campo) return;

    const limpio = valor.trim();
    const corregido = limpio !== campo.valor;

    await ctx.db.patch(id, {
      valor: limpio,
      estado: limpio === "" ? "Vacío" : corregido ? "Corregido" : "Confirmado",
    });

    if (limpio !== "") {
      await ctx.db.insert("bitacora", {
        expedienteId: campo.expedienteId,
        evento: corregido ? "Campo corregido" : "Campo confirmado",
        detalle: `${campo.etiqueta}: ${limpio}`,
        en: new Date().toISOString(),
      });
    }

    await sincronizarValidacion(ctx, campo.documentoId);
  },
});

export const confirmarTodos = mutation({
  args: { documentoId: v.id("documentos") },
  handler: async (ctx, { documentoId }) => {
    const campos = await ctx.db
      .query("campos")
      .withIndex("by_documento", (q) => q.eq("documentoId", documentoId))
      .collect();

    for (const campo of campos) {
      // Un campo vacío no se puede confirmar: no hay nada que confirmar.
      if (campo.valor.trim() === "") continue;
      if (campo.estado === "Pendiente") {
        await ctx.db.patch(campo._id, { estado: "Confirmado" });
      }
    }

    await sincronizarValidacion(ctx, documentoId);
  },
});

/**
 * Un documento queda `Validado` sólo cuando ningún campo espera confirmación y
 * ningún campo crítico está vacío. Hasta entonces no alimenta consultas ni
 * escritos.
 */
async function sincronizarValidacion(
  ctx: MutationCtx,
  documentoId: Id<"documentos">,
): Promise<void> {
  const campos = await ctx.db
    .query("campos")
    .withIndex("by_documento", (q) => q.eq("documentoId", documentoId))
    .collect();

  const pendientes = campos.filter(
    (c) => c.estado === "Pendiente" || (c.critico && c.valor.trim() === ""),
  );

  const documento = await ctx.db.get(documentoId);
  if (!documento || documento.estado === "Error") return;

  if (pendientes.length === 0 && campos.length > 0) {
    await ctx.db.patch(documentoId, {
      estado: "Validado",
      paso: `Validado por el abogado · ${campos.length} campos`,
    });
  } else if (documento.estado === "Validado") {
    await ctx.db.patch(documentoId, {
      estado: "Por validar",
      paso: `${pendientes.length} campos esperando validación`,
    });
  }
}
