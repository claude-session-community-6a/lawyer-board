import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeftIcon, DownloadIcon, LockIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Expediente } from "@/lib/dominio";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { CitaNormativa, EstadoVerificacion } from "../../components/Badges";

function Seccion({
  escritoId,
  seccion,
  fechaVigencia,
}: {
  escritoId: Id<"escritos">;
  seccion: {
    nombre: string;
    contenido: string;
    origen: string;
    verificacion: "Verificado" | "Por verificar" | "Supuesto";
    citas: string[];
  };
  fechaVigencia: string;
}) {
  const generar = useMutation(api.escritos.generarSeccion);
  const editar = useMutation(api.escritos.editarSeccion);
  const [generando, setGenerando] = useState(false);
  const [borrador, setBorrador] = useState<string | null>(null);

  const valor = borrador ?? seccion.contenido;
  const sucio = borrador !== null && borrador !== seccion.contenido;

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold">{seccion.nombre}</h3>
          {seccion.contenido !== "" && (
            <>
              <EstadoVerificacion estado={seccion.verificacion} />
              <span className="text-muted-foreground text-xs">· {seccion.origen}</span>
            </>
          )}
        </div>

        <Button
          size="sm"
          variant="outline"
          disabled={generando}
          onClick={async () => {
            setGenerando(true);
            try {
              // Cada sección se regenera sola; regenerar nunca pisa lo escrito
              // a mano sin que el abogado lo vea, porque el borrador local queda.
              const resultado = await generar({ id: escritoId, seccion: seccion.nombre });
              setBorrador(null);
              if (resultado?.verificacion === "Supuesto") {
                toast.warning(
                  `«${seccion.nombre}» quedó como supuesto: falta ${resultado.faltantes.join(", ")}.`,
                );
              } else {
                toast.success(`«${seccion.nombre}» generada y verificada.`);
              }
            } finally {
              setGenerando(false);
            }
          }}
        >
          {generando ? <Spinner /> : <SparklesIcon data-icon="inline-start" />}
          {seccion.contenido === "" ? "Generar" : "Regenerar"}
        </Button>
      </div>

      {seccion.contenido === "" ? (
        <p className="text-muted-foreground text-sm">Sin generar.</p>
      ) : (
        <>
          <Textarea
            value={valor}
            rows={Math.min(16, Math.max(4, valor.split("\n").length + 1))}
            className="font-serif text-sm leading-relaxed"
            onChange={(event) => setBorrador(event.target.value)}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {seccion.citas.map((articulo) => (
                <CitaNormativa
                  key={articulo}
                  articulo={articulo}
                  fechaVigencia={fechaVigencia}
                />
              ))}
            </div>

            {sucio && (
              <Button
                size="sm"
                onClick={async () => {
                  await editar({
                    id: escritoId,
                    seccion: seccion.nombre,
                    contenido: borrador!,
                  });
                  setBorrador(null);
                  toast.success("Corrección guardada. La sección queda a tu nombre.");
                }}
              >
                Guardar corrección
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function EscritoEditor({
  expediente,
  escritoId,
}: {
  expediente: Expediente;
  escritoId: string;
}) {
  const id = escritoId as Id<"escritos">;
  const escrito = useQuery(api.escritos.get, { id });
  const validacion = useQuery(api.escritos.validarCitas, { id });
  const generar = useMutation(api.escritos.generarSeccion);
  const [generandoTodo, setGenerandoTodo] = useState(false);

  if (escrito === undefined || validacion === undefined) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
        <Spinner />
        Cargando escrito…
      </div>
    );
  }
  if (escrito === null || validacion === null) {
    return <p className="py-16 text-center text-sm">Ese escrito ya no existe.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={`/expedientes/${expediente._id}/escritos`}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 self-start text-sm"
      >
        <ArrowLeftIcon className="size-4" />
        Escritos del expediente
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">{escrito.titulo}</h2>
          <p className="text-muted-foreground max-w-2xl text-xs">
            Instrucción del abogado: «{escrito.instruccion}»
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={generandoTodo}
            onClick={async () => {
              setGenerandoTodo(true);
              try {
                for (const seccion of escrito.secciones) {
                  await generar({ id, seccion: seccion.nombre });
                }
                toast.success("Todas las secciones generadas.");
              } finally {
                setGenerandoTodo(false);
              }
            }}
          >
            {generandoTodo ? <Spinner /> : <SparklesIcon data-icon="inline-start" />}
            Generar todas
          </Button>

          {/* La compuerta: sin citas verificadas y sin supuestos, no hay PDF. */}
          <Button
            size="sm"
            disabled={!validacion.puedeExportar}
            title={
              validacion.puedeExportar
                ? "Exportar el escrito a PDF"
                : "Bloqueado: revisa los motivos abajo"
            }
            onClick={() => {
              window.open(`/api/escritos/${escritoId}/pdf`, "_blank");
            }}
          >
            {validacion.puedeExportar ? (
              <DownloadIcon data-icon="inline-start" />
            ) : (
              <LockIcon data-icon="inline-start" />
            )}
            Exportar PDF
          </Button>
        </div>
      </div>

      {!validacion.puedeExportar && (
        <Alert variant="destructive">
          <AlertTitle>La exportación está bloqueada</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc pl-4">
              {validacion.bloqueos.map((motivo) => (
                <li key={motivo}>{motivo}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {validacion.citas.length > 0 && (
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-semibold">
            Validador de citas · vigencia al {expediente.fechaHechos}
          </h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Cada cita se compara contra el texto indexado. Esto es código, no un prompt.
          </p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {validacion.citas.map((cita, indice) => (
              <li
                key={`${cita.seccion}-${cita.articulo}-${indice}`}
                className="flex items-center gap-2 text-xs"
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    cita.valida ? "bg-emerald-500" : "bg-red-500",
                  )}
                />
                <span className="font-mono">LFT {cita.articulo}</span>
                <span className="text-muted-foreground">
                  en «{cita.seccion}» · {cita.motivo}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {escrito.secciones.map((seccion) => (
          <Seccion
            key={seccion.nombre}
            escritoId={id}
            seccion={seccion}
            fechaVigencia={expediente.fechaHechos}
          />
        ))}
      </div>
    </div>
  );
}
