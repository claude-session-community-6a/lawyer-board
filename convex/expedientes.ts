import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  autoridadTipo,
  estadoExpediente,
  fuero,
  lado,
  origen,
  regimen,
} from "./schema";
import { regimenDe } from "./dominio";

/** Listado del despacho, más el conteo de documentos de cada asunto. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const expedientes = await ctx.db.query("expedientes").order("desc").collect();

    return Promise.all(
      expedientes.map(async (expediente) => {
        const documentos = await ctx.db
          .query("documentos")
          .withIndex("by_expediente", (q) => q.eq("expedienteId", expediente._id))
          .collect();

        return {
          ...expediente,
          totalDocumentos: documentos.length,
          porValidar: documentos.filter((d) => d.estado === "Por validar").length,
          enProceso: documentos.filter(
            (d) => !["Validado", "Por validar", "Error"].includes(d.estado),
          ).length,
          conError: documentos.filter((d) => d.estado === "Error").length,
        };
      }),
    );
  },
});

export const get = query({
  args: { id: v.id("expedientes") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const create = mutation({
  args: {
    numero: v.string(),
    autoridadTipo,
    fuero,
    plaza: v.string(),
    fechaPresentacion: v.string(),
    lado,
    origen,
    firmaMaquila: v.optional(v.string()),
    cliente: v.string(),
    actor: v.string(),
    demandado: v.string(),
    fechaHechos: v.string(),
  },
  handler: async (ctx, args) => {
    const creadoEn = new Date().toISOString();

    const id = await ctx.db.insert("expedientes", {
      ...args,
      // Derivado, no capturado. La UI ya lo mostró para que el abogado lo
      // confirmara antes de llegar aquí.
      regimen: regimenDe(args.autoridadTipo),
      caratula: `${args.actor} vs ${args.demandado}`,
      estado: "Activo",
      creadoEn,
    });

    await ctx.db.insert("bitacora", {
      expedienteId: id,
      evento: "Expediente abierto",
      detalle: `${args.numero} · ${args.autoridadTipo} · lado ${args.lado} · origen ${args.origen}`,
      en: creadoEn,
    });

    return id;
  },
});

export const setEstado = mutation({
  args: { id: v.id("expedientes"), estado: estadoExpediente },
  handler: async (ctx, { id, estado }) => {
    await ctx.db.patch(id, { estado });
    await ctx.db.insert("bitacora", {
      expedienteId: id,
      evento: "Cambio de estado",
      detalle: `El expediente pasó a ${estado}`,
      en: new Date().toISOString(),
    });
  },
});

/**
 * Verificación de conflicto de interés contra toda la base del despacho, al
 * cerrar el alta. Coincidencia por nombre normalizado de las partes.
 */
export const conflictos = query({
  args: { cliente: v.string(), contraparte: v.string() },
  handler: async (ctx, { cliente, contraparte }) => {
    const normalizar = (s: string) =>
      s
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const buscados = [normalizar(cliente), normalizar(contraparte)].filter(Boolean);
    if (buscados.length === 0) return [];

    const todos = await ctx.db.query("expedientes").collect();

    return todos
      .filter((e) => {
        const partes = [e.cliente, e.actor, e.demandado].map(normalizar);
        return buscados.some((b) => partes.some((p) => p.includes(b) || b.includes(p)));
      })
      .map((e) => ({
        id: e._id,
        numero: e.numero,
        caratula: e.caratula,
        lado: e.lado,
        cliente: e.cliente,
      }));
  },
});

export const bitacora = query({
  args: { expedienteId: v.id("expedientes") },
  handler: async (ctx, { expedienteId }) =>
    ctx.db
      .query("bitacora")
      .withIndex("by_expediente", (q) => q.eq("expedienteId", expedienteId))
      .order("desc")
      .collect(),
});

/** Semilla de demostración: un asunto completo con sus documentos en pipeline. */
export const sembrarDemo = mutation({
  args: {},
  handler: async (ctx) => {
    const existente = await ctx.db
      .query("expedientes")
      .withIndex("by_numero", (q) => q.eq("numero", "1146/2022"))
      .first();
    if (existente) return existente._id;

    const creadoEn = new Date().toISOString();
    const id = await ctx.db.insert("expedientes", {
      numero: "1146/2022",
      caratula: "Michel Lara Vega vs Frunatural S.A. de C.V.",
      autoridadTipo: "Junta Especial",
      fuero: "Federal",
      plaza: "Morelia, Michoacán",
      fechaPresentacion: "2022-06-02",
      regimen: "Junta",
      lado: "Patronal",
      origen: "Propio",
      cliente: "Frunatural S.A. de C.V.",
      actor: "Michel Lara Vega",
      demandado: "Frunatural S.A. de C.V.",
      fechaHechos: "2018-09-01",
      estado: "Activo",
      creadoEn,
    });

    await ctx.db.insert("bitacora", {
      expedienteId: id,
      evento: "Expediente abierto",
      detalle: "Semilla de demostración",
      en: creadoEn,
    });

    const semillas = [
      { nombre: "Demanda laboral inicial.pdf", tamanoBytes: 1_842_000 },
      { nombre: "Contrato individual de trabajo.pdf", tamanoBytes: 384_000 },
      { nombre: "Recibo de nomina agosto 2018 (CFDI).pdf", tamanoBytes: 221_000 },
      { nombre: "Aviso de rescision escaneado.pdf", tamanoBytes: 2_960_000 },
      { nombre: "Poder notarial del apoderado.pdf", tamanoBytes: 512_000 },
    ];

    for (const [indice, semilla] of semillas.entries()) {
      const documentoId = await ctx.db.insert("documentos", {
        expedienteId: id,
        consecutivo: indice + 1,
        nombre: semilla.nombre,
        tipo: "Sin clasificar",
        tamanoBytes: semilla.tamanoBytes,
        subidoEn: creadoEn,
        estado: "Recibido",
        paso: "En cola",
      });
      await ctx.scheduler.runAfter(400 * (indice + 1), internal.ia.avanzar, {
        documentoId,
        etapa: 0,
      });
    }

    return id;
  },
});
