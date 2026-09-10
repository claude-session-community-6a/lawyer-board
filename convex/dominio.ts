/**
 * Vocabulario y derivaciones del dominio laboral, compartido por el backend de
 * Convex y la UI. Todo lo que aquí vive es determinista: sin modelo de lenguaje.
 */

export type AutoridadTipo =
  | "Junta Especial"
  | "Tribunal Laboral"
  | "Tribunal Administrativo"
  | "Juzgado de Distrito"
  | "Tribunal Colegiado";

export type Fuero = "Federal" | "Local";
export type Regimen = "Junta" | "Tribunal";
export type Lado = "Patronal" | "Trabajador";
export type Origen = "Propio" | "Maquilado";

export type EstadoExpediente = "Borrador" | "Activo" | "Suspendido" | "Concluido";

export type TipoDocumento =
  | "Demanda"
  | "Contestación"
  | "Contrato individual"
  | "Recibo de nómina"
  | "Aviso de rescisión"
  | "Control de asistencia"
  | "Poder notarial"
  | "Identificación"
  | "Prueba documental"
  | "Sin clasificar";

export type EstadoDocumento =
  | "Recibido"
  | "Normalizando"
  | "Clasificando"
  | "Extrayendo"
  | "Por validar"
  | "Validado"
  | "Error";

export type EstadoCampo = "Pendiente" | "Confirmado" | "Corregido" | "Vacío";
export type Verificacion = "Verificado" | "Por verificar" | "Supuesto";

export const AUTORIDADES: AutoridadTipo[] = [
  "Junta Especial",
  "Tribunal Laboral",
  "Tribunal Administrativo",
  "Juzgado de Distrito",
  "Tribunal Colegiado",
];

export const FUEROS: Fuero[] = ["Federal", "Local"];
export const LADOS: Lado[] = ["Patronal", "Trabajador"];
export const ORIGENES: Origen[] = ["Propio", "Maquilado"];

export const TIPOS_DOCUMENTO: TipoDocumento[] = [
  "Demanda",
  "Contestación",
  "Contrato individual",
  "Recibo de nómina",
  "Aviso de rescisión",
  "Control de asistencia",
  "Poder notarial",
  "Identificación",
  "Prueba documental",
  "Sin clasificar",
];

/**
 * El régimen se DERIVA del tipo de autoridad; no se captura. De él cuelga el
 * vocabulario del asunto (laudo vs. sentencia), que es el error más caro del
 * dominio si se trae equivocado en la cabeza.
 */
export function regimenDe(tipo: AutoridadTipo): Regimen {
  return tipo === "Junta Especial" ? "Junta" : "Tribunal";
}

/** Laudo bajo el régimen de Junta; sentencia bajo el de Tribunal. */
export function resolucionDe(regimen: Regimen): string {
  return regimen === "Junta" ? "laudo" : "sentencia";
}

/** El umbral bajo el cual un campo entra vacío y marcado, nunca estimado. */
export const UMBRAL_CONFIANZA = 0.75;

/** Campos que siempre pasan por confirmación humana, vengan al 99%. */
export const CAMPOS_CRITICOS = [
  "numeroExpediente",
  "autoridad",
  "fechaNotificacion",
  "fechaBaja",
  "salarioDiario",
  "montoReclamado",
];
