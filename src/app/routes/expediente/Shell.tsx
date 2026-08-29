import { useParams } from "wouter";
import { useQuery } from "convex/react";

import { Spinner } from "@/components/ui/spinner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { EncabezadoExpediente } from "../../components/EncabezadoExpediente";
import { NoEncontrado } from "../NoEncontrado";
import { Bitacora } from "./Bitacora";
import { Contradicciones } from "./Contradicciones";
import { DocumentoDetalle } from "./DocumentoDetalle";
import { Documentos } from "./Documentos";
import { EscritoEditor } from "./EscritoEditor";
import { Escritos } from "./Escritos";
import { Leyes } from "./Leyes";
import { Resumen } from "./Resumen";

/**
 * Envoltura de todas las subpáginas del expediente: carga el asunto una sola
 * vez, pinta el encabezado persistente y despacha la sección. La sección vive
 * en la URL, así que cada pantalla del flujo es enlazable.
 */
export function ExpedienteShell() {
  const params = useParams<{ id: string; seccion?: string; sub?: string }>();
  const seccion = params.seccion ?? "resumen";

  const expediente = useQuery(
    api.expedientes.get,
    params.id ? { id: params.id as Id<"expedientes"> } : "skip",
  );

  if (!params.id) return <NoEncontrado />;

  // `undefined` es Convex todavía respondiendo; `null` es un 404 de verdad.
  if (expediente === undefined) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
        <Spinner />
        Cargando expediente…
      </div>
    );
  }
  if (expediente === null) return <NoEncontrado />;

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoExpediente expediente={expediente} seccion={seccion} />

      {seccion === "resumen" && <Resumen expediente={expediente} />}

      {seccion === "documentos" &&
        (params.sub ? (
          <DocumentoDetalle expediente={expediente} documentoId={params.sub} />
        ) : (
          <Documentos expediente={expediente} />
        ))}

      {seccion === "contradicciones" && <Contradicciones expediente={expediente} />}
      {seccion === "leyes" && <Leyes expediente={expediente} />}

      {seccion === "escritos" &&
        (params.sub ? (
          <EscritoEditor expediente={expediente} escritoId={params.sub} />
        ) : (
          <Escritos expediente={expediente} />
        ))}

      {seccion === "bitacora" && <Bitacora expediente={expediente} />}
    </div>
  );
}
