import { Link } from "wouter";
import { useQuery } from "convex/react";
import { TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Expediente } from "@/lib/dominio";
import { api } from "../../../../convex/_generated/api";

export function Contradicciones({ expediente }: { expediente: Expediente }) {
  const resultado = useQuery(api.contradicciones.list, {
    expedienteId: expediente._id,
  });

  if (resultado === undefined) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
        <Spinner />
        Cruzando lo alegado contra lo documentado…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Alegado vs. documentado</h2>
        <p className="text-muted-foreground text-sm">
          Comparación mecánica entre lo que afirma la demanda y lo que consta en los
          documentos validados del cliente. Sin modelo de lenguaje: cada renglón es una
          resta o una división que puedes reproducir a mano.
        </p>
      </div>

      {/* "Cero contradicciones" y "no se ejecutó" son estados distintos. */}
      {!resultado.ejecutado ? (
        <Alert>
          <AlertTitle>El cruce no se ejecutó</AlertTitle>
          <AlertDescription>
            {resultado.motivo}{" "}
            <Link
              href={`/expedientes/${expediente._id}/documentos`}
              className="underline underline-offset-2"
            >
              Ir al índice de documentos
            </Link>
          </AlertDescription>
        </Alert>
      ) : resultado.filas.length === 0 ? (
        <Alert>
          <AlertTitle>El cruce se ejecutó y no encontró discrepancias</AlertTitle>
          <AlertDescription>
            Los datos comparables de la demanda coinciden con los de la documental
            validada. Esto es un resultado, no una falta de resultado.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>
              {resultado.filas.length} discrepancia
              {resultado.filas.length === 1 ? "" : "s"} entre lo alegado y lo documentado
            </AlertTitle>
            <AlertDescription>
              Insumo directo del generador de escritos: cada renglón sostiene una excepción.
            </AlertDescription>
          </Alert>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dato</TableHead>
                <TableHead>Alega la contraparte</TableHead>
                <TableHead>Consta en documento</TableHead>
                <TableHead>Fuente</TableHead>
                <TableHead className="text-right">Δ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultado.filas.map((fila) => (
                <TableRow key={fila.dato}>
                  <TableCell className="font-medium">{fila.dato}</TableCell>
                  <TableCell className="text-muted-foreground">{fila.alegado}</TableCell>
                  <TableCell className="font-semibold">{fila.documentado}</TableCell>
                  <TableCell>
                    <Link
                      href={`/expedientes/${expediente._id}/documentos/${fila.fuenteDocumentoId}`}
                      className="text-xs underline underline-offset-2"
                    >
                      {fila.fuenteNombre}, p. {fila.fuentePagina}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold">
                    {fila.delta}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
