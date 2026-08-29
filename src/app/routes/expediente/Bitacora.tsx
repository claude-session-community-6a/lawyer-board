import { useQuery } from "convex/react";

import { Spinner } from "@/components/ui/spinner";
import type { Expediente } from "@/lib/dominio";
import { api } from "../../../../convex/_generated/api";
import { formatFechaHora } from "../../format";

/** Traza del asunto: quién tocó qué y cuándo. Nada se pierde. */
export function Bitacora({ expediente }: { expediente: Expediente }) {
  const eventos = useQuery(api.expedientes.bitacora, {
    expedienteId: expediente._id,
  });

  if (eventos === undefined) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
        <Spinner />
        Cargando bitácora…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">Bitácora del expediente</h2>
      <ol className="flex flex-col gap-3">
        {eventos.map((evento) => (
          <li key={evento._id} className="flex gap-3 border-l-2 pl-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{evento.evento}</span>
              <span className="text-muted-foreground text-xs">{evento.detalle}</span>
              <span className="text-muted-foreground text-[11px]">
                {formatFechaHora(evento.en)}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
