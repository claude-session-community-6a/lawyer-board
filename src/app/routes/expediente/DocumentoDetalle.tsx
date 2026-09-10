import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeftIcon, CheckIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  UMBRAL_CONFIANZA,
  semaforoCampo,
  semaforoDocumento,
  type Campo,
  type Expediente,
} from "@/lib/dominio";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { consecutivo, porcentaje } from "../../format";

/**
 * Visor simulado del documento. En producción es PDF.js con la página real
 * debajo; la capa de resaltado por región y la correspondencia campo ↔ región
 * son exactamente las mismas, y es lo que esta pantalla tiene que demostrar.
 */
function Visor({
  campos,
  pagina,
  resaltado,
  onResaltar,
}: {
  campos: Campo[];
  pagina: number;
  resaltado: string | null;
  onResaltar: (id: string | null) => void;
}) {
  const enPagina = campos.filter((c) => c.pagina === pagina);

  return (
    <div className="bg-muted/40 relative aspect-[8.5/11] w-full overflow-hidden rounded-lg border">
      {/* Renglones de relleno: el documento real va aquí. */}
      <div className="absolute inset-0 flex flex-col gap-2.5 p-8 opacity-40">
        {Array.from({ length: 26 }).map((_, i) => (
          <div
            key={i}
            className="bg-muted-foreground/25 h-2 rounded"
            style={{ width: `${45 + ((i * 37) % 50)}%` }}
          />
        ))}
      </div>

      {enPagina.map((campo) => (
        <button
          key={campo._id}
          type="button"
          onMouseEnter={() => onResaltar(campo._id)}
          onMouseLeave={() => onResaltar(null)}
          onClick={() => {
            onResaltar(campo._id);
            document.getElementById(`campo-${campo._id}`)?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }}
          title={`${campo.etiqueta} · confianza ${porcentaje(campo.confianza)}`}
          className={cn(
            "absolute rounded-sm border-2 transition-all",
            resaltado === campo._id
              ? "border-primary bg-primary/25 ring-primary/30 ring-2"
              : campo.confianza < UMBRAL_CONFIANZA
                ? "border-red-500/60 bg-red-500/10"
                : "border-amber-500/50 bg-amber-500/10",
          )}
          style={{
            left: `${campo.region.x * 100}%`,
            top: `${campo.region.y * 100}%`,
            width: `${campo.region.ancho * 100}%`,
            height: `${campo.region.alto * 100}%`,
          }}
        />
      ))}
    </div>
  );
}

function CampoExtraido({
  campo,
  resaltado,
  onResaltar,
}: {
  campo: Campo;
  resaltado: string | null;
  onResaltar: (id: string | null) => void;
}) {
  const guardar = useMutation(api.documentos.guardarCampo);
  // `null` significa "sin editar": manda el valor del servidor. En cuanto el
  // abogado teclea, el borrador manda hasta que se guarda. No se limpia en
  // `blur` — hacerlo perdía lo tecleado justo al ir a pulsar Confirmar.
  const [borrador, setBorrador] = useState<string | null>(null);

  const valor = borrador ?? campo.valor;
  const semaforo = semaforoCampo(campo.estado);
  const bajo = campo.confianza < UMBRAL_CONFIANZA;
  const confirmado = campo.estado === "Confirmado" || campo.estado === "Corregido";

  return (
    <div
      id={`campo-${campo._id}`}
      onMouseEnter={() => onResaltar(campo._id)}
      onMouseLeave={() => onResaltar(null)}
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3 transition-colors",
        resaltado === campo._id && "border-primary bg-muted/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            {campo.etiqueta}
            {campo.critico && (
              <span
                title="Campo crítico: pasa por confirmación humana aunque venga al 99%"
                className="rounded bg-red-500/10 px-1 py-0.5 text-[10px] font-semibold tracking-wide text-red-700 uppercase dark:text-red-300"
              >
                crítico
              </span>
            )}
          </span>
          <span className="text-muted-foreground font-mono text-[11px]">
            {campo.clave} · p. {campo.pagina}
          </span>
        </div>

        <span
          title={semaforo.leyenda}
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px]",
            bajo
              ? "bg-red-500/10 text-red-700 dark:text-red-300"
              : "bg-muted text-muted-foreground",
          )}
        >
          {porcentaje(campo.confianza)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={valor}
          placeholder={bajo ? "Vacío a propósito — captúralo tú" : ""}
          className={cn("h-8 text-sm", bajo && !valor && "border-red-500/50")}
          onChange={(event) => setBorrador(event.target.value)}
          onKeyDown={async (event) => {
            if (event.key !== "Enter" || valor.trim() === "") return;
            await guardar({ id: campo._id as Id<"campos">, valor });
            setBorrador(null);
          }}
        />
        <Button
          size="sm"
          variant={confirmado ? "secondary" : "default"}
          disabled={valor.trim() === ""}
          onClick={async () => {
            await guardar({ id: campo._id as Id<"campos">, valor });
            setBorrador(null);
          }}
        >
          <CheckIcon data-icon="inline-start" />
          {confirmado ? "Guardado" : "Confirmar"}
        </Button>
      </div>

      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <span className={cn("size-2 rounded-full", semaforo.punto)} />
        {bajo && campo.valor === ""
          ? "Bajo el umbral: el sistema lo dejó vacío en lugar de estimarlo."
          : semaforo.leyenda}
      </span>
    </div>
  );
}

export function DocumentoDetalle({
  expediente,
  documentoId,
}: {
  expediente: Expediente;
  documentoId: string;
}) {
  const documento = useQuery(api.documentos.get, {
    id: documentoId as Id<"documentos">,
  });
  const confirmarTodos = useMutation(api.documentos.confirmarTodos);
  const reprocesar = useMutation(api.documentos.reprocesar);
  const [resaltado, setResaltado] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);

  const paginas = useMemo(() => {
    if (!documento) return [1];
    const total = documento.paginas ?? 1;
    return Array.from({ length: Math.max(total, 1) }, (_, i) => i + 1);
  }, [documento]);

  if (documento === undefined) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
        <Spinner />
        Cargando documento…
      </div>
    );
  }
  if (documento === null) {
    return <p className="py-16 text-center text-sm">Ese documento ya no existe.</p>;
  }

  const semaforo = semaforoDocumento(documento.estado);
  const pendientes = documento.campos.filter(
    (c) => c.estado === "Pendiente" || (c.critico && c.valor.trim() === ""),
  );
  const confirmables = documento.campos.filter(
    (c) => c.estado === "Pendiente" && c.valor.trim() !== "",
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/expedientes/${expediente._id}/documentos`}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm"
        >
          <ArrowLeftIcon className="size-4" />
          Índice del expediente
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            reprocesar({ id: documento._id });
            toast.info("Reprocesando el documento");
          }}
        >
          <RefreshCwIcon data-icon="inline-start" />
          Reprocesar
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">
          <span className="text-muted-foreground font-mono">
            {consecutivo(documento.consecutivo)}
          </span>{" "}
          {documento.nombre}
        </h2>
        <span className={cn("flex items-center gap-2 text-xs", semaforo.color)}>
          <span className={cn("size-2 rounded-full", semaforo.punto)} />
          {documento.estado} · {documento.error ?? documento.paso}
        </span>
      </div>

      {documento.estado === "Error" && (
        <Alert variant="destructive">
          <AlertTitle>El pipeline falló con este documento</AlertTitle>
          <AlertDescription>
            {documento.error} El archivo original se conserva íntegro; puedes reprocesarlo
            o corregir el formato y volver a subirlo.
          </AlertDescription>
        </Alert>
      )}

      {documento.campos.length === 0 && documento.estado !== "Error" && (
        <Alert>
          <AlertTitle>Todavía no hay campos extraídos</AlertTitle>
          <AlertDescription>
            El documento sigue en «{documento.estado}». Esta pantalla se llena sola cuando
            la extracción termine.
          </AlertDescription>
        </Alert>
      )}

      {documento.campos.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <div className="flex flex-col gap-3">
            <Visor
              campos={documento.campos}
              pagina={pagina}
              resaltado={resaltado}
              onResaltar={setResaltado}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {paginas.map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={n === pagina ? "default" : "outline"}
                  onClick={() => setPagina(n)}
                >
                  {n}
                </Button>
              ))}
              <span className="text-muted-foreground ml-2 text-xs">
                Pasa el cursor por un campo para verlo resaltado sobre la foja.
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                Extracción · {documento.campos.length} campos
              </h3>
              <Button
                size="sm"
                variant="outline"
                disabled={confirmables.length === 0}
                onClick={async () => {
                  await confirmarTodos({ documentoId: documento._id });
                  toast.success(`${confirmables.length} campos confirmados`);
                }}
              >
                Confirmar {confirmables.length || ""} sin cambios
              </Button>
            </div>

            {pendientes.length > 0 ? (
              <p className="text-muted-foreground text-xs">
                {pendientes.length === 1
                  ? "Falta 1 campo por validar."
                  : `Faltan ${pendientes.length} campos por validar.`}{" "}
                Hasta entonces el documento no alimenta consultas, contradicciones ni
                escritos.
              </p>
            ) : (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Documento validado. Ya alimenta contradicciones, cumplimiento y escritos.
              </p>
            )}

            <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto pr-1">
              {documento.campos.map((campo) => (
                <CampoExtraido
                  key={campo._id}
                  campo={campo}
                  resaltado={resaltado}
                  onResaltar={setResaltado}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
