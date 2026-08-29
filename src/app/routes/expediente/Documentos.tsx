import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "convex/react";
import { FileTextIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  TIPOS_DOCUMENTO,
  avanceDocumento,
  semaforoDocumento,
  type Expediente,
  type TipoDocumento,
} from "@/lib/dominio";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { consecutivo, formatTamano } from "../../format";
import { FileDropzone } from "../../components/FileDropzone";

const MAX_BYTES = 25 * 1024 * 1024;

/** Sube el archivo y lo registra; el pipeline arranca solo del lado del backend. */
async function subir(archivo: File): Promise<void> {
  const body = new FormData();
  body.append("archivo", archivo);
  const respuesta = await fetch("/api/uploads", { method: "POST", body });
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    throw new Error(detalle?.error ?? `El servidor respondió ${respuesta.status}`);
  }
}

export function Documentos({ expediente }: { expediente: Expediente }) {
  const documentos = useQuery(api.documentos.list, { expedienteId: expediente._id });
  const registrar = useMutation(api.documentos.registrar);
  const cambiarTipo = useMutation(api.documentos.cambiarTipo);
  const reprocesar = useMutation(api.documentos.reprocesar);
  const [subiendo, setSubiendo] = useState(0);

  async function recibir(archivos: File[]) {
    setSubiendo((n) => n + archivos.length);
    for (const archivo of archivos) {
      try {
        if (archivo.size > MAX_BYTES) {
          throw new Error(`«${archivo.name}» excede el límite de 25 MB.`);
        }
        await subir(archivo);
        // El original queda íntegro; lo que sigue lo hace el pipeline.
        await registrar({
          expedienteId: expediente._id,
          nombre: archivo.name,
          tamanoBytes: archivo.size,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falló la carga");
      } finally {
        setSubiendo((n) => n - 1);
      }
    }
  }

  const enProceso =
    documentos?.filter(
      (d) => !["Validado", "Por validar", "Error"].includes(d.estado),
    ).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <FileDropzone onFiles={recibir} disabled={subiendo > 0} />

      {subiendo > 0 && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Spinner />
          Subiendo {subiendo} archivo{subiendo === 1 ? "" : "s"}…
        </div>
      )}

      {enProceso > 0 && (
        <Alert>
          <AlertTitle>
            {enProceso} documento{enProceso === 1 ? "" : "s"} en el pipeline
          </AlertTitle>
          <AlertDescription>
            Normalización a texto, clasificación y extracción de campos. Los estados de
            abajo se actualizan solos; ninguno se salta en silencio.
          </AlertDescription>
        </Alert>
      )}

      {documentos === undefined ? (
        <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
          <Spinner />
          Cargando el índice…
        </div>
      ) : documentos.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          El expediente digital está vacío. Arrastra la demanda, el contrato y los recibos
          de nómina para empezar.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">#</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead className="w-52">Tipo</TableHead>
              <TableHead className="w-72">Estado del pipeline</TableHead>
              <TableHead className="w-24 text-right">Campos</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {documentos.map((documento) => {
              const semaforo = semaforoDocumento(documento.estado);
              const listo = ["Validado", "Por validar", "Error"].includes(documento.estado);

              return (
                <TableRow key={documento._id}>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {consecutivo(documento.consecutivo)}
                  </TableCell>

                  <TableCell>
                    <Link
                      href={`/expedientes/${expediente._id}/documentos/${documento._id}`}
                      className="flex items-center gap-2 text-sm font-medium hover:underline"
                    >
                      <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
                      {documento.nombre}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {formatTamano(documento.tamanoBytes)}
                      {documento.paginas ? ` · ${documento.paginas} págs.` : ""}
                      {documento.requiereOcr ? " · OCR" : ""}
                    </span>
                  </TableCell>

                  <TableCell>
                    {/* La clasificación automática es una propuesta, no una sentencia. */}
                    <Select
                      value={documento.tipo}
                      onValueChange={(tipo) =>
                        cambiarTipo({
                          id: documento._id as Id<"documentos">,
                          tipo: tipo as TipoDocumento,
                        })
                      }
                    >
                      <SelectTrigger size="sm" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_DOCUMENTO.map((tipo) => (
                          <SelectItem key={tipo} value={tipo}>
                            {tipo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col gap-1.5">
                      <span className={cn("flex items-center gap-2 text-xs font-medium", semaforo.color)}>
                        <span className={cn("size-2 rounded-full", semaforo.punto)} />
                        {documento.estado}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {documento.error ?? documento.paso}
                      </span>
                      {!listo && (
                        <Progress value={avanceDocumento(documento.estado)} className="h-1" />
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-right text-xs">
                    {documento.totalCampos === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : documento.camposPendientes === 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {documento.totalCampos}/{documento.totalCampos}
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">
                        {documento.totalCampos - documento.camposPendientes}/
                        {documento.totalCampos}
                      </span>
                    )}
                  </TableCell>

                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Reprocesar este documento"
                      onClick={() => {
                        reprocesar({ id: documento._id as Id<"documentos"> });
                        toast.info(`Reprocesando ${documento.nombre}`);
                      }}
                    >
                      <RefreshCwIcon className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
