import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  AUTORIDADES,
  FUEROS,
  LADOS,
  ORIGENES,
  regimenDe,
  resolucionDe,
  type AutoridadTipo,
  type Fuero,
  type Lado,
  type Origen,
} from "@/lib/dominio";
import { api } from "../../../convex/_generated/api";
import { BadgeLado, BadgeRegimen } from "../components/Badges";

/**
 * Alta guiada de cuatro pasos. Ninguno se puede saltar: implementa el protocolo
 * de apertura del despacho, y una respuesta equivocada aquí invalida todo el
 * análisis posterior del asunto.
 */
const PASOS = [
  { numero: 1, titulo: "Autoridad", ayuda: "De aquí se deriva el régimen del asunto." },
  { numero: 2, titulo: "Lado", ayuda: "Invierte la carga probatoria y la teoría del caso." },
  { numero: 3, titulo: "Origen", ayuda: "Determina marca, facturación y segmentación." },
  { numero: 4, titulo: "Partes y hechos", ayuda: "La fecha de los hechos fija la ley aplicable." },
] as const;

interface Datos {
  numero: string;
  autoridadTipo: AutoridadTipo | "";
  fuero: Fuero | "";
  plaza: string;
  fechaPresentacion: string;
  lado: Lado | "";
  origen: Origen | "";
  firmaMaquila: string;
  cliente: string;
  actor: string;
  demandado: string;
  fechaHechos: string;
}

const INICIAL: Datos = {
  numero: "",
  // Sin valor por defecto: un default aquí es una respuesta que nadie dio.
  autoridadTipo: "",
  fuero: "",
  plaza: "",
  fechaPresentacion: "",
  lado: "",
  origen: "",
  firmaMaquila: "",
  cliente: "",
  actor: "",
  demandado: "",
  fechaHechos: "",
};

export function NuevoExpediente() {
  const [, navigate] = useLocation();
  const crear = useMutation(api.expedientes.create);
  const [paso, setPaso] = useState(1);
  const [datos, setDatos] = useState<Datos>(INICIAL);
  const [guardando, setGuardando] = useState(false);

  const set = <K extends keyof Datos>(campo: K, valor: Datos[K]) =>
    setDatos((actual) => ({ ...actual, [campo]: valor }));

  // Conflicto de interés contra toda la base del despacho, en vivo mientras se
  // capturan las partes.
  const conflictos = useQuery(
    api.expedientes.conflictos,
    datos.cliente.trim() !== "" || datos.actor.trim() !== ""
      ? { cliente: datos.cliente.trim(), contraparte: datos.actor.trim() }
      : "skip",
  );

  const completo: Record<number, boolean> = {
    1:
      datos.numero.trim() !== "" &&
      datos.autoridadTipo !== "" &&
      datos.fuero !== "" &&
      datos.plaza.trim() !== "" &&
      datos.fechaPresentacion !== "",
    2: datos.lado !== "",
    3: datos.origen !== "" && (datos.origen !== "Maquilado" || datos.firmaMaquila.trim() !== ""),
    4:
      datos.cliente.trim() !== "" &&
      datos.actor.trim() !== "" &&
      datos.demandado.trim() !== "" &&
      datos.fechaHechos !== "",
  };

  const regimen = datos.autoridadTipo ? regimenDe(datos.autoridadTipo) : null;

  async function guardar() {
    setGuardando(true);
    try {
      const id = await crear({
        numero: datos.numero.trim(),
        autoridadTipo: datos.autoridadTipo as AutoridadTipo,
        fuero: datos.fuero as Fuero,
        plaza: datos.plaza.trim(),
        fechaPresentacion: datos.fechaPresentacion,
        lado: datos.lado as Lado,
        origen: datos.origen as Origen,
        firmaMaquila:
          datos.origen === "Maquilado" ? datos.firmaMaquila.trim() : undefined,
        cliente: datos.cliente.trim(),
        actor: datos.actor.trim(),
        demandado: datos.demandado.trim(),
        fechaHechos: datos.fechaHechos,
      });
      toast.success("Expediente abierto. Ahora carga sus documentos.");
      navigate(`/expedientes/${id}/documentos`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo abrir el expediente");
      setGuardando(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Alta guiada de expediente</h1>
        <p className="text-muted-foreground text-sm">
          Cuatro pasos, ninguno opcional.
        </p>
      </div>

      <ol className="flex flex-wrap gap-2">
        {PASOS.map((p) => (
          <li key={p.numero}>
            <button
              type="button"
              // Sólo se puede volver atrás o avanzar al inmediato siguiente si
              // el actual está completo: el asistente no se salta.
              disabled={p.numero > paso && !completo[paso]}
              onClick={() => setPaso(p.numero)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                paso === p.numero
                  ? "border-primary bg-muted font-medium"
                  : completo[p.numero]
                    ? "text-muted-foreground border-emerald-500/40"
                    : "text-muted-foreground",
                p.numero > paso && !completo[paso] && "opacity-40",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[11px] font-semibold",
                  completo[p.numero]
                    ? "bg-emerald-500 text-white"
                    : "bg-muted-foreground/15",
                )}
              >
                {completo[p.numero] ? <CheckIcon className="size-3" /> : p.numero}
              </span>
              {p.titulo}
            </button>
          </li>
        ))}
      </ol>

      <Card>
        <CardHeader>
          <CardTitle>
            Paso {paso} · {PASOS[paso - 1]!.titulo}
          </CardTitle>
          <CardDescription>{PASOS[paso - 1]!.ayuda}</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {paso === 1 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="autoridad">Tipo de autoridad</FieldLabel>
                  <Select
                    value={datos.autoridadTipo}
                    onValueChange={(v) => set("autoridadTipo", v as AutoridadTipo)}
                  >
                    <SelectTrigger id="autoridad">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {AUTORIDADES.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="fuero">Fuero</FieldLabel>
                  <Select value={datos.fuero} onValueChange={(v) => set("fuero", v as Fuero)}>
                    <SelectTrigger id="fuero">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {FUEROS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="plaza">Plaza</FieldLabel>
                  <Input
                    id="plaza"
                    placeholder="Morelia, Michoacán"
                    value={datos.plaza}
                    onChange={(e) => set("plaza", e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="numero">Número de expediente</FieldLabel>
                  <Input
                    id="numero"
                    placeholder="1146/2022"
                    value={datos.numero}
                    onChange={(e) => set("numero", e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="presentacion">Fecha de presentación</FieldLabel>
                  <Input
                    id="presentacion"
                    type="date"
                    value={datos.fechaPresentacion}
                    onChange={(e) => set("fechaPresentacion", e.target.value)}
                  />
                </Field>
              </div>

              {regimen && (
                <Alert>
                  <AlertTitle className="flex items-center gap-2">
                    Régimen derivado <BadgeRegimen regimen={regimen} />
                  </AlertTitle>
                  <AlertDescription>
                    Con esa autoridad, el asunto se resuelve por{" "}
                    <strong>{resolucionDe(regimen)}</strong>. El régimen no se captura: se
                    deriva y se te muestra para que lo confirmes. Nunca se infiere en
                    silencio.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {paso === 2 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {LADOS.map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  onClick={() => set("lado", opcion)}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                    datos.lado === opcion ? "border-primary bg-muted" : "hover:bg-muted/50",
                  )}
                >
                  <BadgeLado lado={opcion} />
                  <span className="text-muted-foreground text-xs">
                    {opcion === "Patronal"
                      ? "Representamos al patrón: sobre él pesa la carga de probar salario, jornada, antigüedad y causa de la separación."
                      : "Representamos al trabajador: la carga de esos hechos corresponde a la contraparte."}
                  </span>
                </button>
              ))}
            </div>
          )}

          {paso === 3 && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {ORIGENES.map((opcion) => (
                  <button
                    key={opcion}
                    type="button"
                    onClick={() => set("origen", opcion)}
                    className={cn(
                      "flex flex-col items-start gap-1.5 rounded-lg border p-4 text-left transition-colors",
                      datos.origen === opcion ? "border-primary bg-muted" : "hover:bg-muted/50",
                    )}
                  >
                    <span className="text-sm font-medium">{opcion}</span>
                    <span className="text-muted-foreground text-xs">
                      {opcion === "Propio"
                        ? "Asunto del despacho, con su propia marca y facturación."
                        : "Maquilado para otra firma: cambia la marca del entregable y segmenta el acceso."}
                    </span>
                  </button>
                ))}
              </div>

              {datos.origen === "Maquilado" && (
                <Field>
                  <FieldLabel htmlFor="firma">Firma para la que se maquila</FieldLabel>
                  <Input
                    id="firma"
                    value={datos.firmaMaquila}
                    onChange={(e) => set("firmaMaquila", e.target.value)}
                  />
                </Field>
              )}
            </>
          )}

          {paso === 4 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="cliente">Cliente</FieldLabel>
                  <Input
                    id="cliente"
                    value={datos.cliente}
                    onChange={(e) => set("cliente", e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="actor">Parte actora</FieldLabel>
                  <Input
                    id="actor"
                    value={datos.actor}
                    onChange={(e) => set("actor", e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="demandado">Parte demandada</FieldLabel>
                  <Input
                    id="demandado"
                    value={datos.demandado}
                    onChange={(e) => set("demandado", e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="hechos">Fecha de los hechos</FieldLabel>
                  <Input
                    id="hechos"
                    type="date"
                    value={datos.fechaHechos}
                    onChange={(e) => set("fechaHechos", e.target.value)}
                  />
                  <FieldDescription>
                    Fija qué versión de la ley aplica a todo el asunto.
                  </FieldDescription>
                </Field>
              </div>

              {conflictos && conflictos.length > 0 && (
                <Alert variant="destructive">
                  <TriangleAlertIcon />
                  <AlertTitle>Posible conflicto de interés</AlertTitle>
                  <AlertDescription>
                    Estas partes ya aparecen en {conflictos.length} asunto
                    {conflictos.length === 1 ? "" : "s"} del despacho:
                    <ul className="mt-1 list-disc pl-4">
                      {conflictos.map((c) => (
                        <li key={c.id}>
                          {c.numero} · {c.caratula} · lado {c.lado}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>

        <CardFooter className="justify-between">
          <Button
            variant="ghost"
            disabled={paso === 1}
            onClick={() => setPaso((p) => p - 1)}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Atrás
          </Button>

          {paso < 4 ? (
            <Button disabled={!completo[paso]} onClick={() => setPaso((p) => p + 1)}>
              Continuar
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          ) : (
            <Button disabled={!completo[4] || guardando} onClick={guardar}>
              <CheckIcon data-icon="inline-start" />
              Abrir expediente
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
