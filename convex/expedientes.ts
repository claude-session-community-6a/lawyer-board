import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { estadoExpediente, materia } from "./schema";

/** Every expediente with its documents attached, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const expedientes = await ctx.db.query("expedientes").order("desc").collect();

    return Promise.all(
      expedientes.map(async (expediente) => ({
        ...expediente,
        documentos: await ctx.db
          .query("documentos")
          .withIndex("by_expediente", (q) => q.eq("expedienteId", expediente._id))
          .collect(),
      })),
    );
  },
});

export const get = query({
  args: { id: v.id("expedientes") },
  handler: async (ctx, { id }) => {
    const expediente = await ctx.db.get(id);
    if (!expediente) return null;

    const documentos = await ctx.db
      .query("documentos")
      .withIndex("by_expediente", (q) => q.eq("expedienteId", id))
      .collect();

    return { ...expediente, documentos };
  },
});

export const create = mutation({
  args: {
    numero: v.string(),
    caratula: v.string(),
    materia,
    estado: estadoExpediente,
    juzgado: v.string(),
    actor: v.string(),
    demandado: v.string(),
    cliente: v.string(),
  },
  handler: async (ctx, args) =>
    ctx.db.insert("expedientes", { ...args, creadoEn: new Date().toISOString() }),
});

export const setEstado = mutation({
  args: { id: v.id("expedientes"), estado: estadoExpediente },
  handler: async (ctx, { id, estado }) => {
    await ctx.db.patch(id, { estado });
  },
});
