import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Expediente } from "@/lib/expedientes";

export interface SsrPayload {
  /** Pathname Astro rendered, used to prime wouter's router. */
  path: string;
  /** Query string (without the leading `?`) Astro rendered. */
  search: string;
  expedientes: Expediente[];
}

interface Store {
  ssr: SsrPayload;
  expedientes: Expediente[];
  /** Adds a freshly created expediente so the SPA sees it without a reload. */
  agregarExpediente: (expediente: Expediente) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({
  ssr,
  children,
}: {
  ssr: SsrPayload;
  children: ReactNode;
}) {
  // Seeded from the server render, then owned by the client for the rest of
  // the session. A reload re-seeds it from Astro.
  const [expedientes, setExpedientes] = useState(ssr.expedientes);

  const value = useMemo<Store>(
    () => ({
      ssr,
      expedientes,
      agregarExpediente: (expediente) =>
        setExpedientes((current) => [expediente, ...current]),
    }),
    [ssr, expedientes]
  );

  return <StoreContext value={value}>{children}</StoreContext>;
}

export function useStore(): Store {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside <StoreProvider>");
  return value;
}
