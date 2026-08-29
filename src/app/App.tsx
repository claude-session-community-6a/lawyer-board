import { ConvexProvider } from "convex/react";
import { Route, Router, Switch } from "wouter";

import { Toaster } from "@/components/ui/sonner";
import { convex } from "./convex";
import { AppShell } from "./components/AppShell";
import { StoreProvider, type SsrPayload } from "./store";
import { ExpedienteDetalle } from "./routes/ExpedienteDetalle";
import { ExpedientesList } from "./routes/ExpedientesList";
import { NoEncontrado } from "./routes/NoEncontrado";
import { NuevoExpediente } from "./routes/NuevoExpediente";

export default function App({ ssr }: { ssr: SsrPayload }) {
  return (
    <ConvexProvider client={convex}>
      <StoreProvider ssr={ssr}>
        {/* ssrPath/ssrSearch keep the server render and the hydrated client on
          the same route, so there is no flash of the wrong screen. */}
        <Router ssrPath={ssr.path} ssrSearch={ssr.search}>
          <AppShell>
            <Switch>
              <Route path="/" component={ExpedientesList} />
              <Route path="/expedientes" component={ExpedientesList} />
              <Route path="/expedientes/nuevo" component={NuevoExpediente} />
              <Route path="/expedientes/:id" component={ExpedienteDetalle} />
              <Route component={NoEncontrado} />
            </Switch>
          </AppShell>
        </Router>
        <Toaster position="bottom-right" />
      </StoreProvider>
    </ConvexProvider>
  );
}
