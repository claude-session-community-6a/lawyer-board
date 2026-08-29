import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import { mapExpediente, type Expediente } from "@/lib/expedientes";

export interface SsrPayload {
  /** Pathname Astro rendered, used to prime wouter's router. */
  path: string;
  /** Query string (without the leading `?`) Astro rendered. */
  search: string;
  /** The Convex list as of the server render, so the first paint has data. */
  expedientes: Expediente[];
}

interface Store {
  ssr: SsrPayload;
  /** Live from Convex; falls back to the SSR snapshot until the socket opens. */
  expedientes: Expediente[];
  /** True only before Convex has answered for the first time. */
  cargando: boolean;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({
  ssr,
  children,
}: {
  ssr: SsrPayload;
  children: ReactNode;
}) {
  // Convex pushes every write to every subscriber, so a created expediente
  // shows up here without anyone telling the store about it.
  const live = useQuery(api.expedientes.list);

  const value = useMemo<Store>(
    () => ({
      ssr,
      expedientes: live ? live.map(mapExpediente) : ssr.expedientes,
      cargando: live === undefined,
    }),
    [ssr, live]
  );

  return <StoreContext value={value}>{children}</StoreContext>;
}

export function useStore(): Store {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside <StoreProvider>");
  return value;
}
