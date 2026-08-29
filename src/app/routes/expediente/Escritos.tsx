import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "convex/react";
import { FileSignatureIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { Expediente } from "@/lib/dominio";
import { api } from "../../../../convex/_generated/api";
import { formatFechaHora } from "../../format";

export function Escritos({ expediente }: { expediente: Expediente }) {
  const escritos = useQuery(api.escritos.list, { expedienteId: expediente._id });
  const crear = useMutation(api.escritos.crear);
  const [, navigate] = useLocation();

  const [titulo, setTitulo] = useState("Contestación de demanda");
  const [instruccion, setInstruccion] = useState(
    "Contesta negando el despido y apóyate en la discrepancia de salario que sale de la tabla de contradicciones. Tono sobrio, sin adjetivos.",
  );
  const [creando, setCreando] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Nuevo escrito</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="titulo">Título</FieldLabel>
            <Input
              id="titulo"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="instruccion">Tu instrucción</FieldLabel>
            <Textarea
              id="instruccion"
              rows={3}
              value={instruccion}
              onChange={(event) => setInstruccion(event.target.value)}
            />
            <FieldDescription>
              Viaja como mensaje del abogado, nunca concatenada a las reglas del sistema:
              las reglas duras ganan siempre. Se guarda con el escrito para poder
              reproducir después con qué se generó.
            </FieldDescription>
          </Field>

          <Button
            className="self-start"
            disabled={titulo.trim() === "" || creando}
            onClick={async () => {
              setCreando(true);
              try {
                const id = await crear({
                  expedienteId: expediente._id,
                  titulo: titulo.trim(),
                  instruccion: instruccion.trim(),
                });
                navigate(`/expedientes/${expediente._id}/escritos/${id}`);
              } finally {
                setCreando(false);
              }
            }}
          >
            <PlusIcon data-icon="inline-start" />
            Crear y abrir el editor
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Escritos del expediente</h3>
        {escritos === undefined ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Spinner />
            Cargando…
          </div>
        ) : escritos.length === 0 ? (
          <p className="text-muted-foreground py-6 text-sm">
            Todavía no hay escritos en este asunto.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {escritos.map((escrito) => {
              const generadas = escrito.secciones.filter((s) => s.contenido !== "").length;
              const supuestos = escrito.secciones.filter(
                (s) => s.verificacion === "Supuesto",
              ).length;

              return (
                <li key={escrito._id}>
                  <Link
                    href={`/expedientes/${expediente._id}/escritos/${escrito._id}`}
                    className="hover:bg-muted/50 flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors"
                  >
                    <span className="flex items-center gap-2.5 text-sm font-medium">
                      <FileSignatureIcon className="text-muted-foreground size-4" />
                      {escrito.titulo}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {generadas}/{escrito.secciones.length} secciones
                      {supuestos > 0 && ` · ${supuestos} con supuestos`} ·{" "}
                      {formatFechaHora(escrito.actualizadoEn)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
