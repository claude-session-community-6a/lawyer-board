import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "convex/react";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  MATERIAS,
  TIPOS_DOCUMENTO,
  type Materia,
  type TipoDocumento,
} from "@/lib/expedientes";
import { api } from "../../../convex/_generated/api";
import { formatTamano } from "../format";
import { FileDropzone } from "../components/FileDropzone";
import { useUploads } from "../use-uploads";

interface Datos {
  numero: string;
  caratula: string;
  materia: Materia;
  juzgado: string;
  actor: string;
  demandado: string;
  cliente: string;
}

const DATOS_INICIALES: Datos = {
  numero: "",
  caratula: "",
  materia: "Civil",
  juzgado: "",
  actor: "",
  demandado: "",
  cliente: "",
};

export function NuevoExpediente() {
  const [, navigate] = useLocation();
  const crearExpediente = useMutation(api.expedientes.create);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [datos, setDatos] = useState<Datos>(DATOS_INICIALES);
  const [guardando, setGuardando] = useState(false);
  const { uploads, agregar, quitar, cambiarTipo } = useUploads();

  const subiendo = uploads.some((u) => u.estado === "subiendo");
  const listos = uploads.filter((u) => u.estado === "listo");
  const fallidos = uploads.filter((u) => u.estado === "error");
  const puedeContinuar = listos.length > 0 && !subiendo;
  const faltantes = (["numero", "caratula", "cliente"] as const).filter(
    (campo) => datos[campo].trim() === ""
  );

  function set<K extends keyof Datos>(campo: K, valor: Datos[K]) {
    setDatos((current) => ({ ...current, [campo]: valor }));
  }

  async function guardar() {
    setGuardando(true);
    try {
      // Straight to Convex: the mutation writes the expediente and its
      // documents together, and every open list updates itself.
      const id = await crearExpediente({
        ...datos,
        documentos: listos.map((u) => ({
          nombre: u.nombre,
          tipo: u.tipo,
          tamanoBytes: u.tamanoBytes,
        })),
      });
      toast.success("Expediente creado", {
        description: `${datos.numero} · ${listos.length} documento(s) adjuntos.`,
      });
      navigate(`/expedientes/${id}`);
    } catch (error) {
      toast.error("No se pudo crear el expediente", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Nuevo expediente
        </h1>
        <p className="text-muted-foreground text-sm">
          Paso {paso} de 2 · {paso === 1 ? "Documentos" : "Datos del asunto"}
        </p>
      </div>

      {paso === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Documentos del expediente</CardTitle>
            <CardDescription>
              Empieza cargando la demanda, poderes e identificaciones. Puedes
              ajustar el tipo de cada documento antes de continuar.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <FileDropzone onFiles={agregar} />

            {uploads.length > 0 && (
              <ul className="border-border divide-border divide-y rounded-xl border">
                {uploads.map((upload) => (
                  <li
                    key={upload.id}
                    className="flex flex-wrap items-center gap-3 p-3"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {upload.nombre}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {formatTamano(upload.tamanoBytes)}
                        </span>
                        {upload.estado === "listo" && (
                          <Badge variant="secondary">
                            <CheckIcon data-icon="inline-start" />
                            Cargado
                          </Badge>
                        )}
                        {upload.estado === "error" && (
                          <Badge variant="destructive">{upload.error}</Badge>
                        )}
                      </div>
                      {upload.estado === "subiendo" && (
                        <Progress value={upload.progreso} />
                      )}
                    </div>

                    <Select
                      value={upload.tipo}
                      onValueChange={(value) =>
                        cambiarTipo(upload.id, value as TipoDocumento)
                      }
                      disabled={upload.estado !== "listo"}
                    >
                      <SelectTrigger size="sm" className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {TIPOS_DOCUMENTO.map((tipo) => (
                            <SelectItem key={tipo} value={tipo}>
                              {tipo}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Quitar ${upload.nombre}`}
                      onClick={() => quitar(upload.id)}
                    >
                      <XIcon />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {fallidos.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>
                  {fallidos.length} archivo(s) no se cargaron
                </AlertTitle>
                <AlertDescription>
                  Quítalos de la lista e inténtalo de nuevo; el resto del
                  expediente se conserva.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="justify-between">
            <span className="text-muted-foreground text-sm">
              {listos.length} de {uploads.length} documentos listos
            </span>
            <Button disabled={!puedeContinuar} onClick={() => setPaso(2)}>
              Continuar
              {subiendo ? (
                <Spinner data-icon="inline-end" />
              ) : (
                <ArrowRightIcon data-icon="inline-end" />
              )}
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Datos del asunto</CardTitle>
            <CardDescription>
              Se registrarán junto con {listos.length} documento(s) ya cargados.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <FieldGroup>
              <Field data-invalid={datos.numero.trim() === "" || undefined}>
                <FieldLabel htmlFor="numero">Número de expediente</FieldLabel>
                <Input
                  id="numero"
                  placeholder="142/2025"
                  value={datos.numero}
                  aria-invalid={datos.numero.trim() === "" || undefined}
                  onChange={(event) => set("numero", event.target.value)}
                />
                <FieldDescription>
                  Tal como lo asigna el juzgado o tribunal.
                </FieldDescription>
              </Field>

              <Field data-invalid={datos.caratula.trim() === "" || undefined}>
                <FieldLabel htmlFor="caratula">Carátula</FieldLabel>
                <Input
                  id="caratula"
                  placeholder="Actor vs. Demandado"
                  value={datos.caratula}
                  aria-invalid={datos.caratula.trim() === "" || undefined}
                  onChange={(event) => set("caratula", event.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="materia">Materia</FieldLabel>
                <Select
                  value={datos.materia}
                  onValueChange={(value) => set("materia", value as Materia)}
                >
                  <SelectTrigger id="materia" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {MATERIAS.map((materia) => (
                        <SelectItem key={materia} value={materia}>
                          {materia}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="juzgado">Juzgado o tribunal</FieldLabel>
                <Input
                  id="juzgado"
                  placeholder="Juzgado Cuarto de Distrito en Materia Civil, CDMX"
                  value={datos.juzgado}
                  onChange={(event) => set("juzgado", event.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="actor">Actor</FieldLabel>
                <Input
                  id="actor"
                  value={datos.actor}
                  onChange={(event) => set("actor", event.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="demandado">Demandado</FieldLabel>
                <Input
                  id="demandado"
                  value={datos.demandado}
                  onChange={(event) => set("demandado", event.target.value)}
                />
              </Field>

              <Field data-invalid={datos.cliente.trim() === "" || undefined}>
                <FieldLabel htmlFor="cliente">Cliente</FieldLabel>
                <Input
                  id="cliente"
                  value={datos.cliente}
                  aria-invalid={datos.cliente.trim() === "" || undefined}
                  onChange={(event) => set("cliente", event.target.value)}
                />
                <FieldDescription>
                  A quién se le factura y para quién se litiga el asunto.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>

          <Separator />

          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={() => setPaso(1)}>
              <ArrowLeftIcon data-icon="inline-start" />
              Documentos
            </Button>
            <Button
              disabled={faltantes.length > 0 || guardando}
              onClick={guardar}
            >
              {guardando ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <CheckIcon data-icon="inline-start" />
              )}
              Crear expediente
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
