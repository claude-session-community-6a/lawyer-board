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
 * In-memory stand-in for the database. Replaced by a real store later; it exists
 * so the SSR page and the API route read from the same place.
 */
const expedientes: Expediente[] = [
  {
    id: "exp-2024-0142",
    numero: "142/2024",
    caratula: "Constructora Alfa S.A. de C.V. vs. Grupo Meridiano",
    materia: "Mercantil",
    estado: "Activo",
    juzgado: "Juzgado Cuarto de Distrito en Materia Civil, CDMX",
    actor: "Constructora Alfa S.A. de C.V.",
    demandado: "Grupo Meridiano S. de R.L.",
    cliente: "Constructora Alfa S.A. de C.V.",
    creadoEn: "2024-11-04T16:20:00.000Z",
    documentos: [
      {
        id: "doc-1",
        nombre: "demanda-inicial.pdf",
        tipo: "Demanda",
        tamanoBytes: 842_113,
        subidoEn: "2024-11-04T16:22:00.000Z",
      },
      {
        id: "doc-2",
        nombre: "poder-notarial-38412.pdf",
        tipo: "Poder notarial",
        tamanoBytes: 331_002,
        subidoEn: "2024-11-04T16:25:00.000Z",
      },
    ],
  },
  {
    id: "exp-2025-0031",
    numero: "31/2025",
    caratula: "Ramírez Osuna, Lucía vs. Distribuidora Norte",
    materia: "Laboral",
    estado: "Activo",
    juzgado: "Junta Especial No. 7 de la Local de Conciliación y Arbitraje",
    actor: "Lucía Ramírez Osuna",
    demandado: "Distribuidora Norte S.A. de C.V.",
    cliente: "Lucía Ramírez Osuna",
    creadoEn: "2025-02-18T14:05:00.000Z",
    documentos: [
      {
        id: "doc-3",
        nombre: "contrato-individual.pdf",
        tipo: "Contrato",
        tamanoBytes: 118_540,
        subidoEn: "2025-02-18T14:09:00.000Z",
      },
    ],
  },
  {
    id: "exp-2025-0088",
    numero: "88/2025",
    caratula: "Sucesión testamentaria a bienes de J. Treviño",
    materia: "Familiar",
    estado: "Suspendido",
    juzgado: "Juzgado Décimo Primero de lo Familiar, Monterrey",
    actor: "Albacea designado",
    demandado: "N/A",
    cliente: "Familia Treviño Lara",
    creadoEn: "2025-06-02T11:45:00.000Z",
    documentos: [],
  },
];

export function listExpedientes(): Expediente[] {
  return expedientes;
}

export function getExpediente(id: string): Expediente | undefined {
  return expedientes.find((e) => e.id === id || e.numero === id);
}

export function createExpediente(
  input: Omit<Expediente, "id" | "creadoEn" | "estado"> & {
    estado?: EstadoExpediente;
  }
): Expediente {
  const expediente: Expediente = {
    ...input,
    id: `exp-${Date.now()}`,
    estado: input.estado ?? "Borrador",
    creadoEn: new Date().toISOString(),
  };
  expedientes.unshift(expediente);
  return expediente;
}
