import { useSearchParams } from "wouter";
import { useQuery } from "convex/react";
import { SearchIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api } from "../../../convex/_generated/api";
import { formatFecha } from "../format";

const HOY = new Date().toISOString().slice(0, 10);

/**
 * Biblioteca normativa. El selector de vigencia está siempre visible porque
 * "qué dice el artículo 47" sin decir cuándo es una pregunta mal hecha: la
 * respuesta cambia con la fecha de los hechos del asunto.
 */
export function Biblioteca() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const fecha = searchParams.get("fecha") ?? HOY;

  const resultado = useQuery(api.normativa.buscar, { q, fechaVigencia: fecha });

  const actualizar = (cambios: Record<string, string>) => {
    const siguiente: Record<string, string> = { q, fecha, ...cambios };
    setSearchParams(
      Object.fromEntries(Object.entries(siguiente).filter(([, v]) => v !== "")),
      { replace: true },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Biblioteca normativa</h1>
        <p className="text-muted-foreground text-sm">
          Ley Federal del Trabajo indexada por precepto, con su historial de vigencias.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Field className="flex-1">
          <FieldLabel htmlFor="q">Buscar</FieldLabel>
          <div className="relative">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              id="q"
              value={q}
              placeholder="Artículo, rubro o texto — p. ej. «47» o «prescripción»"
              className="pl-8"
              onChange={(event) => actualizar({ q: event.target.value })}
            />
          </div>
        </Field>

        <Field className="w-48 flex-none">
          <FieldLabel htmlFor="fecha">Vigencia a la fecha</FieldLabel>
          <Input
            id="fecha"
            type="date"
            value={fecha}
            onChange={(event) => actualizar({ fecha: event.target.value })}
          />
        </Field>
      </div>

      {resultado === undefined ? (
        <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
          <Spinner />
          Consultando el corpus…
        </div>
      ) : (
        <>
          <p className="text-muted-foreground text-xs">
            {resultado.total} preceptos vigentes al {formatFecha(resultado.fechaVigencia)}
            {resultado.fueraDeVigencia > 0 &&
              ` · ${resultado.fueraDeVigencia} versiones quedaron fuera por vigencia, no por inexistencia`}
          </p>

          {resultado.preceptos.length === 0 ? (
            <Alert>
              <AlertTitle>La búsqueda se ejecutó y no devolvió preceptos</AlertTitle>
              <AlertDescription>
                Con ese término y esa fecha de vigencia no hay coincidencias en el corpus
                indexado. Eso no significa que el precepto no exista: prueba otra fecha.
              </AlertDescription>
            </Alert>
          ) : (
            <ul className="flex flex-col gap-3">
              {resultado.preceptos.map((precepto) => (
                <li
                  key={`${precepto.articulo}-${precepto.vigenteDesde}`}
                  className="rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-sm font-semibold">
                      Artículo {precepto.articulo}
                      {precepto.fraccion ? `, ${precepto.fraccion}` : ""} —{" "}
                      <span className="font-normal">{precepto.rubro}</span>
                    </h2>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      vigente desde {formatFecha(precepto.vigenteDesde)}
                      {precepto.vigenteHasta
                        ? ` hasta ${formatFecha(precepto.vigenteHasta)}`
                        : ""}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {precepto.texto}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
