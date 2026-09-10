import { ConvexProvider } from "convex/react";
import { Redirect, Route, Router, Switch } from "wouter";

import { Toaster } from "@/components/ui/sonner";
import { convex } from "./convex";
import { AppShell } from "./components/AppShell";
import { StoreProvider, type SsrPayload } from "./store";
import { Biblioteca } from "./routes/Biblioteca";
import { ExpedientesList } from "./routes/ExpedientesList";
import { NoEncontrado } from "./routes/NoEncontrado";
import { NuevoExpediente } from "./routes/NuevoExpediente";
import { Tablero } from "./routes/Tablero";
import { ExpedienteShell } from "./routes/expediente/Shell";

export default function App({ ssr }: { ssr: SsrPayload }) {
  return (
    <ConvexProvider client={convex}>
      <StoreProvider ssr={ssr}>
        {/* ssrPath/ssrSearch mantienen el render del servidor y el cliente
          hidratado en la misma ruta: sin parpadeo de la pantalla equivocada. */}
        <Router ssrPath={ssr.path} ssrSearch={ssr.search}>
          <AppShell>
            <Switch>
              <Route path="/" component={Tablero} />
              <Route path="/expedientes" component={ExpedientesList} />
              <Route path="/expedientes/nuevo" component={NuevoExpediente} />
              <Route path="/biblioteca" component={Biblioteca} />

              {/* Un expediente sin sección entra por su resumen. */}
              <Route path="/expedientes/:id">
                {(params) => <Redirect to={`/expedientes/${params.id}/resumen`} replace />}
              </Route>
              <Route path="/expedientes/:id/:seccion" component={ExpedienteShell} />
              <Route path="/expedientes/:id/:seccion/:sub" component={ExpedienteShell} />

              <Route component={NoEncontrado} />
            </Switch>
          </AppShell>
        </Router>
        <Toaster position="bottom-right" />
      </StoreProvider>
    </ConvexProvider>
  );
}
