import { Link } from "wouter";
import { useMutation } from "convex/react";
import {
  AlertTriangleIcon,
  ClockIcon,
  CogIcon,
  PlusIcon,
  SproutIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { api } from "../../../convex/_generated/api";
import { useStore } from "../store";
import { formatFecha } from "../format";
import { BadgeLado, BadgeRegimen } from "../components/Badges";

/** Conclusión arriba, desarrollo abajo: se abre entre pendientes, desde el teléfono. */
export function Tablero() {
  const { expedientes, cargando } = useStore();
  const sembrar = useMutation(api.expedientes.sembrarDemo);

  const porValidar = expedientes.reduce((total, e) => total + e.porValidar, 0);
  const enProceso = expedientes.reduce((total, e) => total + e.enProceso, 0);
  const conError = expedientes.reduce((total, e) => total + e.conError, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Tablero</h1>
          <p className="text-muted-foreground text-sm">
            Lo que exige atención hoy, antes que cualquier otra cosa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {expedientes.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await sembrar({});
                toast.success("Asunto de demostración sembrado.");
              }}
            >
              <SproutIcon data-icon="inline-start" />
              Sembrar demostración
            </Button>
          )}
          <Link href="/expedientes/nuevo" className={buttonVariants({ size: "sm" })}>
            <PlusIcon data-icon="inline-start" />
            Nuevo expediente
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <ClockIcon className="size-4" />
              Esperando validación
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {cargando ? <Spinner /> : porValidar}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm">
              <CogIcon className="size-4" />
              En el pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {cargando ? <Spinner /> : enProceso}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertTriangleIcon className="size-4" />
              Trabajos fallidos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {cargando ? <Spinner /> : conError}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Asuntos con actividad</h2>
        {expedientes.length === 0 ? (
          <p className="text-muted-foreground py-6 text-sm">
            Sin asuntos todavía.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {expedientes.slice(0, 8).map((expediente) => (
              <li key={expediente._id}>
                <Link
                  href={`/expedientes/${expediente._id}/resumen`}
                  className="hover:bg-muted/50 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 transition-colors"
                >
                  <span className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{expediente.caratula}</span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {expediente.numero} · hechos {formatFecha(expediente.fechaHechos)}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <BadgeRegimen regimen={expediente.regimen} />
                    <BadgeLado lado={expediente.lado} />
                    {expediente.porValidar > 0 && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        {expediente.porValidar} por validar
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
