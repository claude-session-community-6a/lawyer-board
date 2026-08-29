import { useQuery } from "convex/react";
import { CheckCircle2Icon, CircleHelpIcon, XCircleIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { Expediente } from "@/lib/dominio";
import { api } from "../../../../convex/_generated/api";
import { formatFecha } from "../../format";
import { CitaNormativa } from "../../components/Badges";

const APARIENCIA = {
  Cumple: {
    icono: CheckCircle2Icon,
    clase: "text-emerald-600 dark:text-emerald-400",
    borde: "border-l-emerald-500",
  },
  "No cumple": {
    icono: XCircleIcon,
    clase: "text-red-600 dark:text-red-400",
    borde: "border-l-red-500",
  },
  "Falta dato": {
    icono: CircleHelpIcon,
    clase: "text-amber-600 dark:text-amber-400",
    borde: "border-l-amber-500",
  },
  "No aplica": {
    icono: CircleHelpIcon,
    clase: "text-muted-foreground",
    borde: "border-l-muted",
  },
} as const;

export function Leyes({ expediente }: { expediente: Expediente }) {
  const evaluacion = useQuery(api.cumplimiento.evaluar, {
    expedienteId: expediente._id,
  });

  if (evaluacion === undefined) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
        <Spinner />
        Evaluando el expediente contra el corpus…
      </div>
    );
  }
  if (evaluacion === null) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Cumplimiento normativo</h2>
        <p className="text-muted-foreground text-sm">
          Reglas deterministas sobre los campos <strong>validados</strong> del expediente,
          citando la Ley Federal del Trabajo{" "}
          <strong>en la vigencia del {formatFecha(expediente.fechaHechos)}</strong>, que es
          la fecha de los hechos del asunto. Ningún resultado sale de un modelo.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["Cumple", evaluacion.resumen.cumple],
            ["No cumple", evaluacion.resumen.noCumple],
            ["Falta dato", evaluacion.resumen.faltaDato],
          ] as const
        ).map(([estado, total]) => {
          const { icono: Icono, clase } = APARIENCIA[estado];
          return (
            <Card key={estado}>
              <CardHeader>
                <CardTitle className={cn("flex items-center gap-2 text-sm", clase)}>
                  <Icono className="size-4" />
                  {estado}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{total}</CardContent>
            </Card>
          );
        })}
      </div>

      {evaluacion.documentosValidados < evaluacion.totalDocumentos && (
        <Alert>
          <AlertTitle>
            {evaluacion.totalDocumentos - evaluacion.documentosValidados} documentos aún sin
            validar
          </AlertTitle>
          <AlertDescription>
            Sus campos no cuentan para esta evaluación. Un dato extraído y no confirmado no
            acredita ni desacredita nada.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        {evaluacion.resultados.map((regla) => {
          const { icono: Icono, clase, borde } = APARIENCIA[regla.estado];
          return (
            <div key={regla.id} className={cn("rounded-lg border border-l-4 p-4", borde)}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Icono className={cn("size-4 shrink-0", clase)} />
                    {regla.titulo}
                  </span>
                  <span className="text-muted-foreground text-xs">{regla.rubro}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-semibold", clase)}>{regla.estado}</span>
                  <CitaNormativa
                    articulo={regla.articulo.split(",")[0]!}
                    fechaVigencia={evaluacion.fechaVigencia}
                  />
                </div>
              </div>

              <p className="mt-3 text-sm">{regla.hallazgo}</p>

              {regla.accion && (
                <p className="text-muted-foreground mt-1.5 text-xs">
                  <strong>Siguiente paso:</strong> {regla.accion}
                </p>
              )}

              <details className="group mt-3">
                <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
                  Ver el texto del artículo {regla.articulo} (vigente desde{" "}
                  {formatFecha(regla.vigenteDesde)})
                </summary>
                <blockquote className="text-muted-foreground border-muted mt-2 border-l-2 pl-3 text-xs leading-relaxed">
                  {regla.textoPrecepto}
                </blockquote>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}
