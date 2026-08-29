import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const materia = v.union(
  v.literal("Civil"),
  v.literal("Mercantil"),
  v.literal("Penal"),
  v.literal("Laboral"),
  v.literal("Familiar"),
  v.literal("Amparo"),
  v.literal("Administrativo"),
);

export const estadoExpediente = v.union(
  v.literal("Borrador"),
  v.literal("Activo"),
  v.literal("Suspendido"),
  v.literal("Concluido"),
);

export const tipoDocumento = v.union(
  v.literal("Demanda"),
  v.literal("Contestación"),
  v.literal("Poder notarial"),
  v.literal("Identificación"),
  v.literal("Contrato"),
  v.literal("Prueba documental"),
  v.literal("Otro"),
);

export default defineSchema({
  expedientes: defineTable({
    numero: v.string(),
    caratula: v.string(),
    materia,
    estado: estadoExpediente,
    juzgado: v.string(),
    actor: v.string(),
    demandado: v.string(),
    cliente: v.string(),
    creadoEn: v.string(),
  })
    .index("by_numero", ["numero"])
    .index("by_estado", ["estado"]),

  documentos: defineTable({
    expedienteId: v.id("expedientes"),
    nombre: v.string(),
    tipo: tipoDocumento,
    tamanoBytes: v.number(),
    subidoEn: v.string(),
    // Set once the file itself lives in Convex file storage.
    storageId: v.optional(v.id("_storage")),
  }).index("by_expediente", ["expedienteId"]),
});
