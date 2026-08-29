import { Link, useSearchParams } from "wouter";
import { useMutation } from "convex/react";
import { FolderOpenIcon, PlusIcon, SearchIcon, SproutIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { estadoExpedienteVariante } from "@/lib/dominio";
import { api } from "../../../convex/_generated/api";
import { useStore } from "../store";
import { formatFecha } from "../format";
import { BadgeLado, BadgeRegimen } from "../components/Badges";

export function ExpedientesList() {
  const { expedientes, cargando } = useStore();
  const sembrar = useMutation(api.expedientes.sembrarDemo);
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const termino = q.trim().toLowerCase();
  const visibles = termino
    ? expedientes.filter((e) =>
        [e.numero, e.caratula, e.cliente, e.plaza, e.autoridadTipo]
          .join(" ")
          .toLowerCase()
          .includes(termino),
      )
    : expedientes;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Expedientes</h1>
          <p className="text-muted-foreground text-sm">
            {cargando ? "Cargando…" : `${expedientes.length} asuntos en el despacho.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              value={q}
              placeholder="Número, carátula, cliente o plaza"
              className="w-72 pl-8"
              onChange={(event) => {
                const valor = event.target.value;
                setSearchParams(valor ? { q: valor } : {}, { replace: true });
              }}
            />
          </div>
          <Link href="/expedientes/nuevo" className={buttonVariants({ size: "sm" })}>
            <PlusIcon data-icon="inline-start" />
            Nuevo
          </Link>
        </div>
      </div>

      {expedientes.length === 0 && !cargando ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderOpenIcon />
            </EmptyMedia>
            <EmptyTitle>Todavía no hay expedientes</EmptyTitle>
            <EmptyDescription>
              Da de alta un asunto con el asistente de cuatro pasos, o siembra el asunto de
              demostración con sus documentos para verlo pasar por el pipeline.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row gap-2">
            <Link href="/expedientes/nuevo" className={buttonVariants()}>
              <PlusIcon data-icon="inline-start" />
              Alta guiada
            </Link>
            <Button
              variant="outline"
              onClick={async () => {
                await sembrar({});
                toast.success("Asunto de demostración sembrado; sus documentos ya están en el pipeline.");
              }}
            >
              <SproutIcon data-icon="inline-start" />
              Sembrar demostración
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expediente</TableHead>
              <TableHead className="w-52">Régimen y lado</TableHead>
              <TableHead className="w-56">Autoridad</TableHead>
              <TableHead className="w-40">Documentos</TableHead>
              <TableHead className="w-28 text-right">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((expediente) => (
              <TableRow key={expediente._id}>
                <TableCell>
                  <Link
                    href={`/expedientes/${expediente._id}/resumen`}
                    className="flex flex-col gap-0.5 hover:underline"
                  >
                    <span className="text-sm font-medium">{expediente.caratula}</span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {expediente.numero} · hechos {formatFecha(expediente.fechaHechos)}
                    </span>
                  </Link>
                </TableCell>

                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    <BadgeRegimen regimen={expediente.regimen} />
                    <BadgeLado lado={expediente.lado} />
                  </div>
                </TableCell>

                <TableCell className="text-muted-foreground text-xs">
                  {expediente.autoridadTipo}
                  <br />
                  {expediente.fuero} · {expediente.plaza}
                </TableCell>

                <TableCell className="text-xs">
                  {expediente.totalDocumentos === 0 ? (
                    <span className="text-muted-foreground">Sin documentos</span>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <span>{expediente.totalDocumentos} en el índice</span>
                      {expediente.enProceso > 0 && (
                        <span className="text-sky-600 dark:text-sky-400">
                          {expediente.enProceso} en pipeline
                        </span>
                      )}
                      {expediente.porValidar > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                          {expediente.porValidar} por validar
                        </span>
                      )}
                      {expediente.conError > 0 && (
                        <span className="text-red-600 dark:text-red-400">
                          {expediente.conError} con error
                        </span>
                      )}
                    </div>
                  )}
                </TableCell>

                <TableCell className="text-right">
                  <Badge variant={estadoExpedienteVariante(expediente.estado)}>
                    {expediente.estado}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
