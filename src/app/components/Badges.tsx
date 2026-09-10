import { ScaleIcon, UserIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Lado, Regimen, Verificacion } from "@/lib/dominio";
import { resolucionDe } from "@/lib/dominio";

/**
 * El régimen y el lado se muestran con color fijo en todas las pantallas del
 * expediente. Trabajar un asunto con el régimen o el lado equivocado en la
 * cabeza es el error más caro del dominio; estos dos chips son el antídoto.
 */
export function BadgeRegimen({ regimen }: { regimen: Regimen }) {
  return (
    <Badge
      variant="outline"
      title={`Régimen ${regimen} · la resolución se llama ${resolucionDe(regimen)}`}
      className={cn(
        "gap-1 font-semibold",
        regimen === "Junta"
          ? "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300"
          : "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      )}
    >
      <ScaleIcon className="size-3" />
      {regimen.toUpperCase()}
    </Badge>
  );
}

export function BadgeLado({ lado }: { lado: Lado }) {
  return (
    <Badge
      variant="outline"
      title={`Lado ${lado} · invierte la carga probatoria y la teoría del caso`}
      className={cn(
        "gap-1 font-semibold",
        lado === "Patronal"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      )}
    >
      <UserIcon className="size-3" />
      {lado.toUpperCase()}
    </Badge>
  );
}

export function EstadoVerificacion({ estado }: { estado: Verificacion }) {
  const mapa = {
    Verificado: {
      punto: "bg-emerald-500",
      clase: "text-emerald-700 dark:text-emerald-300",
      ayuda: "Consta en documento validado.",
    },
    "Por verificar": {
      punto: "bg-amber-500",
      clase: "text-amber-700 dark:text-amber-300",
      ayuda: "Sin fuente confirmada todavía.",
    },
    Supuesto: {
      punto: "bg-red-500",
      clase: "text-red-700 dark:text-red-300",
      ayuda: "Descansa en un supuesto. Bloquea la exportación.",
    },
  }[estado];

  return (
    <span
      title={mapa.ayuda}
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium", mapa.clase)}
    >
      <span className={cn("size-2 rounded-full", mapa.punto)} />
      {estado}
    </span>
  );
}

/** Chip clicable a un artículo, en la vigencia que aplica al asunto. */
export function CitaNormativa({
  articulo,
  fechaVigencia,
  ordenamiento = "LFT",
}: {
  articulo: string;
  fechaVigencia: string;
  ordenamiento?: string;
}) {
  return (
    <a
      href={`/biblioteca?q=${encodeURIComponent(articulo)}&fecha=${fechaVigencia}`}
      className="bg-muted hover:bg-muted/70 inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-xs underline-offset-2 hover:underline"
    >
      {ordenamiento} {articulo}
    </a>
  );
}
