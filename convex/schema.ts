import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Vocabulario del dominio laboral. El régimen NO es un campo libre: se deriva
 * del tipo de autoridad (ver `regimenDe` en convex/dominio.ts) y el abogado lo
 * confirma en pantalla. Nunca se infiere en silencio.
 */
export const autoridadTipo = v.union(
  v.literal("Junta Especial"),
  v.literal("Tribunal Laboral"),
  v.literal("Tribunal Administrativo"),
  v.literal("Juzgado de Distrito"),
  v.literal("Tribunal Colegiado"),
);

export const fuero = v.union(v.literal("Federal"), v.literal("Local"));
export const regimen = v.union(v.literal("Junta"), v.literal("Tribunal"));
export const lado = v.union(v.literal("Patronal"), v.literal("Trabajador"));
export const origen = v.union(v.literal("Propio"), v.literal("Maquilado"));

export const estadoExpediente = v.union(
  v.literal("Borrador"),
  v.literal("Activo"),
  v.literal("Suspendido"),
  v.literal("Concluido"),
);

export const tipoDocumento = v.union(
  v.literal("Demanda"),
  v.literal("Contestación"),
  v.literal("Contrato individual"),
  v.literal("Recibo de nómina"),
  v.literal("Aviso de rescisión"),
  v.literal("Control de asistencia"),
  v.literal("Poder notarial"),
  v.literal("Identificación"),
  v.literal("Prueba documental"),
  v.literal("Sin clasificar"),
);

/** Estados del pipeline de ingesta. Cada uno es observable en la UI. */
export const estadoDocumento = v.union(
  v.literal("Recibido"),
  v.literal("Normalizando"),
  v.literal("Clasificando"),
  v.literal("Extrayendo"),
  v.literal("Por validar"),
  v.literal("Validado"),
  v.literal("Error"),
);

/**
 * Un campo bajo el umbral de confianza entra `Vacío`, jamás relleno con una
 * estimación. Los campos críticos entran `Pendiente` aunque vengan al 99%.
 */
export const estadoCampo = v.union(
  v.literal("Pendiente"),
  v.literal("Confirmado"),
  v.literal("Corregido"),
  v.literal("Vacío"),
);

export const verificacion = v.union(
  v.literal("Verificado"),
  v.literal("Por verificar"),
  v.literal("Supuesto"),
);

export default defineSchema({
  expedientes: defineTable({
    numero: v.string(),
    caratula: v.string(),

    // Paso 1 · Autoridad
    autoridadTipo,
    fuero,
    plaza: v.string(),
    fechaPresentacion: v.string(),
    regimen,

    // Paso 2 · Lado
    lado,

    // Paso 3 · Origen
    origen,
    firmaMaquila: v.optional(v.string()),

    // Paso 4 · Partes y hechos
    cliente: v.string(),
    actor: v.string(),
    demandado: v.string(),
    fechaHechos: v.string(),

    estado: estadoExpediente,
    creadoEn: v.string(),
  })
    .index("by_numero", ["numero"])
    .index("by_estado", ["estado"]),

  documentos: defineTable({
    expedienteId: v.id("expedientes"),
    // Numeración de la casa: 01.-, 02.-, … la asigna el sistema.
    consecutivo: v.number(),
    nombre: v.string(),
    tipo: tipoDocumento,
    tamanoBytes: v.number(),
    subidoEn: v.string(),
    estado: estadoDocumento,
    // Bitácora corta del pipeline, para que nada falle en silencio.
    paso: v.string(),
    paginas: v.optional(v.number()),
    requiereOcr: v.optional(v.boolean()),
    error: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
  })
    .index("by_expediente", ["expedienteId"])
    .index("by_estado", ["estado"]),

  campos: defineTable({
    expedienteId: v.id("expedientes"),
    documentoId: v.id("documentos"),
    clave: v.string(),
    etiqueta: v.string(),
    valor: v.string(),
    confianza: v.number(),
    critico: v.boolean(),
    estado: estadoCampo,
    pagina: v.number(),
    // Región normalizada (0-1) sobre la página, para resaltar sobre la imagen.
    region: v.object({
      x: v.number(),
      y: v.number(),
      ancho: v.number(),
      alto: v.number(),
    }),
  })
    .index("by_documento", ["documentoId"])
    .index("by_expediente", ["expedienteId"]),

  escritos: defineTable({
    expedienteId: v.id("expedientes"),
    titulo: v.string(),
    // La instrucción del abogado viaja como mensaje de usuario y se guarda
    // junto al escrito para poder reproducir con qué se generó.
    instruccion: v.string(),
    secciones: v.array(
      v.object({
        nombre: v.string(),
        contenido: v.string(),
        origen: v.string(),
        verificacion,
        citas: v.array(v.string()),
      }),
    ),
    creadoEn: v.string(),
    actualizadoEn: v.string(),
  }).index("by_expediente", ["expedienteId"]),

  bitacora: defineTable({
    expedienteId: v.id("expedientes"),
    evento: v.string(),
    detalle: v.string(),
    en: v.string(),
  }).index("by_expediente", ["expedienteId"]),
});
