export type Materia =
  | "Civil"
  | "Mercantil"
  | "Penal"
  | "Laboral"
  | "Familiar"
  | "Amparo"
  | "Administrativo";

export type EstadoExpediente = "Borrador" | "Activo" | "Suspendido" | "Concluido";

export type TipoDocumento =
  | "Demanda"
  | "Contestación"
  | "Poder notarial"
  | "Identificación"
  | "Contrato"
  | "Prueba documental"
  | "Otro";

export interface DocumentoExpediente {
  id: string;
  nombre: string;
  tipo: TipoDocumento;
  tamanoBytes: number;
  subidoEn: string;
}

export interface Expediente {
  id: string;
  numero: string;
  caratula: string;
  materia: Materia;
  estado: EstadoExpediente;
  juzgado: string;
  actor: string;
  demandado: string;
  cliente: string;
  creadoEn: string;
  documentos: DocumentoExpediente[];
}

export const MATERIAS: Materia[] = [
  "Civil",
  "Mercantil",
  "Penal",
  "Laboral",
  "Familiar",
  "Amparo",
  "Administrativo",
];

export const TIPOS_DOCUMENTO: TipoDocumento[] = [
  "Demanda",
  "Contestación",
  "Poder notarial",
  "Identificación",
  "Contrato",
  "Prueba documental",
  "Otro",
];

/**
 * Convex rows carry `_id`/`_creationTime`; the UI works in terms of `id`.
 * These map one to the other so components stay free of Convex naming.
 */
export function mapDocumento(row: {
  _id: string;
  nombre: string;
  tipo: TipoDocumento;
  tamanoBytes: number;
  subidoEn: string;
}): DocumentoExpediente {
  return {
    id: row._id,
    nombre: row.nombre,
    tipo: row.tipo,
    tamanoBytes: row.tamanoBytes,
    subidoEn: row.subidoEn,
  };
}

export function mapExpediente(row: {
  _id: string;
  numero: string;
  caratula: string;
  materia: Materia;
  estado: EstadoExpediente;
  juzgado: string;
  actor: string;
  demandado: string;
  cliente: string;
  creadoEn: string;
  documentos: Array<Parameters<typeof mapDocumento>[0]>;
}): Expediente {
  return {
    id: row._id,
    numero: row.numero,
    caratula: row.caratula,
    materia: row.materia,
    estado: row.estado,
    juzgado: row.juzgado,
    actor: row.actor,
    demandado: row.demandado,
    cliente: row.cliente,
    creadoEn: row.creadoEn,
    documentos: row.documentos.map(mapDocumento),
  };
}
