import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";

/** Lo que devuelve `expedientes.list`: el asunto más el pulso de su índice. */
export type ExpedienteEnLista = (typeof api.expedientes.list)["_returnType"][number];

export interface SsrPayload {
  /** Pathname que renderizó Astro, para primar el router de wouter. */
  path: string;
  /** Query string (sin `?`) que renderizó Astro. */
  search: string;
  /** El listado de Convex al momento del render, para que el primer pintado traiga datos. */
  expedientes: ExpedienteEnLista[];
}

interface Store {
  ssr: SsrPayload;
  /** En vivo desde Convex; cae al snapshot del SSR hasta que abre el socket. */
  expedientes: ExpedienteEnLista[];
  /** Cierto sólo antes de la primera respuesta de Convex. */
  cargando: boolean;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ ssr, children }: { ssr: SsrPayload; children: ReactNode }) {
  // Convex empuja cada escritura a cada suscriptor: un expediente creado o un
  // documento que avanza en el pipeline aparecen aquí sin que nadie avise.
  const live = useQuery(api.expedientes.list);

  const value = useMemo<Store>(
    () => ({
      ssr,
      expedientes: live ?? ssr.expedientes,
      cargando: live === undefined,
    }),
    [ssr, live],
  );

  return <StoreContext value={value}>{children}</StoreContext>;
}

export function useStore(): Store {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore debe usarse dentro de <StoreProvider>");
  return value;
}
