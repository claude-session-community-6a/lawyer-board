export * from "../../convex/dominio";
export { PRECEPTOS, vigentesA, preceptoA, REFORMA_2019 } from "../../convex/corpus/lft";
export type { Precepto } from "../../convex/corpus/lft";

import type { Doc } from "../../convex/_generated/dataModel";
import type { EstadoCampo, EstadoDocumento, EstadoExpediente } from "../../convex/dominio";

export type Expediente = Doc<"expedientes">;
export type Documento = Doc<"documentos">;
export type Campo = Doc<"campos">;
export type Escrito = Doc<"escritos">;

type Variante = "default" | "secondary" | "outline" | "destructive";

export function estadoExpedienteVariante(estado: EstadoExpediente): Variante {
  switch (estado) {
    case "Activo":
      return "default";
    case "Borrador":
      return "outline";
    case "Suspendido":
      return "destructive";
    case "Concluido":
      return "secondary";
  }
}

/**
 * Semáforo del índice documental. El color no es decoración: dice si el
 * documento ya puede alimentar consultas y escritos, o todavía no.
 */
export function semaforoDocumento(estado: EstadoDocumento): {
  color: string;
  punto: string;
  leyenda: string;
} {
  switch (estado) {
    case "Validado":
      return {
        color: "text-emerald-600 dark:text-emerald-400",
        punto: "bg-emerald-500",
        leyenda: "Validado por el abogado",
      };
    case "Por validar":
      return {
        color: "text-amber-600 dark:text-amber-400",
        punto: "bg-amber-500",
        leyenda: "Esperando validación humana",
      };
    case "Error":
      return {
        color: "text-red-600 dark:text-red-400",
        punto: "bg-red-500",
        leyenda: "El pipeline falló",
      };
    default:
      return {
        color: "text-muted-foreground",
        punto: "bg-sky-500 animate-pulse",
        leyenda: "En proceso",
      };
  }
}

export function semaforoCampo(estado: EstadoCampo): { punto: string; leyenda: string } {
  switch (estado) {
    case "Confirmado":
      return { punto: "bg-emerald-500", leyenda: "Confirmado sin cambios" };
    case "Corregido":
      return { punto: "bg-sky-500", leyenda: "Corregido por el abogado" };
    case "Vacío":
      return { punto: "bg-red-500", leyenda: "Bajo el umbral · vacío a propósito" };
    case "Pendiente":
      return { punto: "bg-amber-500", leyenda: "Esperando confirmación" };
  }
}

/** Las etapas del pipeline, en orden, para dibujar el avance. */
export const ETAPAS: EstadoDocumento[] = [
  "Recibido",
  "Normalizando",
  "Clasificando",
  "Extrayendo",
  "Por validar",
  "Validado",
];

export function avanceDocumento(estado: EstadoDocumento): number {
  if (estado === "Error") return 100;
  const indice = ETAPAS.indexOf(estado);
  return indice < 0 ? 0 : Math.round(((indice + 1) / ETAPAS.length) * 100);
}
