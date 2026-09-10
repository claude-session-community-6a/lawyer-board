import { Link } from "wouter";
import { useQuery } from "convex/react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { resolucionDe, type Expediente } from "@/lib/dominio";
import { api } from "../../../../convex/_generated/api";
import { formatFecha } from "../../format";

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{etiqueta}</dt>
      <dd className="text-sm">{valor || "—"}</dd>
    </div>
  );
}

export function Resumen({ expediente }: { expediente: Expediente }) {
  const documentos = useQuery(api.documentos.list, { expedienteId: expediente._id });
  const cumplimiento = useQuery(api.cumplimiento.evaluar, {
    expedienteId: expediente._id,
  });

  const porValidar = documentos?.filter((d) => d.estado === "Por validar") ?? [];
  const conError = documentos?.filter((d) => d.estado === "Error") ?? [];

  return (
    <div className="flex flex-col gap-5">
      {porValidar.length > 0 && (
        <Alert>
          <AlertTitle>
            {porValidar.length} documento{porValidar.length === 1 ? "" : "s"} esperando
            validación
          </AlertTitle>
          <AlertDescription>
            <Link
              href={`/expedientes/${expediente._id}/documentos`}
              className="underline underline-offset-2"
            >
              Revisar la extracción
            </Link>{" "}
            — hasta validarlos no alimentan consultas ni escritos.
          </AlertDescription>
        </Alert>
      )}

      {conError.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>
            {conError.length} documento{conError.length === 1 ? "" : "s"} con fallo de
            ingesta
          </AlertTitle>
          <AlertDescription>
            {conError.map((d) => d.nombre).join(", ")}. Nada falla en silencio: revisa el
            índice y reprocesa.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Identidad del asunto</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Dato etiqueta="Número" valor={expediente.numero} />
              <Dato etiqueta="Presentación" valor={formatFecha(expediente.fechaPresentacion)} />
              <Dato etiqueta="Autoridad" valor={`${expediente.autoridadTipo} · ${expediente.fuero}`} />
              <Dato etiqueta="Plaza" valor={expediente.plaza} />
              <Dato
                etiqueta="Régimen (derivado)"
                valor={`${expediente.regimen} · resuelve por ${resolucionDe(expediente.regimen)}`}
              />
              <Dato etiqueta="Lado" valor={expediente.lado} />
              <Dato
                etiqueta="Origen"
                valor={
                  expediente.origen === "Maquilado"
                    ? `Maquilado · ${expediente.firmaMaquila ?? "firma sin capturar"}`
                    : "Propio"
                }
              />
              <Dato etiqueta="Fecha de los hechos" valor={formatFecha(expediente.fechaHechos)} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Partes</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Dato etiqueta="Cliente" valor={expediente.cliente} />
              <Dato etiqueta="Actor" valor={expediente.actor} />
              <Dato etiqueta="Demandado" valor={expediente.demandado} />
              <Dato etiqueta="Abierto" valor={formatFecha(expediente.creadoEn)} />
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Expediente digital</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {documentos === undefined ? (
              <Spinner />
            ) : (
              <>
                {documentos.filter((d) => d.estado === "Validado").length}
                <span className="text-muted-foreground text-base font-normal">
                  {" "}
                  / {documentos.length} validados
                </span>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cumplimiento</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {cumplimiento === undefined || cumplimiento === null ? (
              <Spinner />
            ) : (
              <>
                {cumplimiento.resumen.noCumple}
                <span className="text-muted-foreground text-base font-normal">
                  {" "}
                  hallazgos en contra
                </span>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Datos por confirmar</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {cumplimiento === undefined || cumplimiento === null ? (
              <Spinner />
            ) : (
              <>
                {cumplimiento.resumen.faltaDato}
                <span className="text-muted-foreground text-base font-normal">
                  {" "}
                  reglas sin dato
                </span>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
