import { Link } from "wouter";
import { BuildingIcon, CalendarIcon, FolderIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { estadoExpedienteVariante, type Expediente } from "@/lib/dominio";
import { formatFecha } from "../format";
import { BadgeLado, BadgeRegimen } from "./Badges";

const SECCIONES = [
  ["resumen", "Resumen"],
  ["documentos", "Documentos"],
  ["contradicciones", "Contradicciones"],
  ["leyes", "Leyes"],
  ["escritos", "Escritos"],
  ["bitacora", "Bitácora"],
] as const;

/**
 * Bloque de identidad del asunto. Acompaña a TODAS las subpáginas del
 * expediente y nunca se colapsa: es la referencia contra la que el abogado
 * verifica, de un vistazo, que está trabajando el asunto correcto bajo el
 * régimen y el lado correctos.
 */
export function EncabezadoExpediente({
  expediente,
  seccion,
}: {
  expediente: Expediente;
  seccion: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card rounded-xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold tracking-tight">{expediente.caratula}</h1>
            <p className="text-muted-foreground font-mono text-xs">
              exp. {expediente.numero}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BadgeRegimen regimen={expediente.regimen} />
            <BadgeLado lado={expediente.lado} />
            <Badge variant={estadoExpedienteVariante(expediente.estado)}>
              {expediente.estado}
            </Badge>
          </div>
        </div>

        <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
          <span className="flex items-center gap-1.5">
            <BuildingIcon className="size-3.5" />
            {expediente.autoridadTipo} · {expediente.fuero} · {expediente.plaza}
          </span>
          <span className="flex items-center gap-1.5">
            <FolderIcon className="size-3.5" />
            {expediente.origen}
            {expediente.firmaMaquila ? ` · ${expediente.firmaMaquila}` : ""}
          </span>
          <span
            className="flex items-center gap-1.5"
            title="Fija qué versión de la ley aplica a todo el asunto"
          >
            <CalendarIcon className="size-3.5" />
            Hechos: {formatFecha(expediente.fechaHechos)}
          </span>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b pb-px">
        {SECCIONES.map(([slug, etiqueta]) => (
          <Link
            key={slug}
            href={`/expedientes/${expediente._id}/${slug}`}
            className={cn(
              "rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors",
              seccion === slug
                ? "border-primary text-foreground border-b-2"
                : "text-muted-foreground hover:text-foreground border-b-2 border-transparent",
            )}
          >
            {etiqueta}
          </Link>
        ))}
      </nav>
    </div>
  );
}
