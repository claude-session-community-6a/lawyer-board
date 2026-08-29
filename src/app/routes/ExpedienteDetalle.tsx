import { Link, useParams } from "wouter";
import { ArrowLeftIcon, FileTextIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStore } from "../store";
import { estadoVariant, formatFecha, formatTamano } from "../format";
import { NoEncontrado } from "./NoEncontrado";

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{etiqueta}</dt>
      <dd className="text-sm">{valor || "—"}</dd>
    </div>
  );
}

export function ExpedienteDetalle() {
  const { id } = useParams<{ id: string }>();
  const { expedientes } = useStore();
  const expediente = expedientes.find((e) => e.id === id || e.numero === id);

  if (!expediente) return <NoEncontrado />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/expedientes"
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "self-start",
          })}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Expedientes
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {expediente.numero}
          </h1>
          <Badge variant={estadoVariant(expediente.estado)}>
            {expediente.estado}
          </Badge>
          <Badge variant="outline">{expediente.materia}</Badge>
        </div>
        <p className="text-muted-foreground text-sm">{expediente.caratula}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del asunto</CardTitle>
          <CardDescription>
            Alta el {formatFecha(expediente.creadoEn)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato etiqueta="Juzgado" valor={expediente.juzgado} />
            <Dato etiqueta="Cliente" valor={expediente.cliente} />
            <Dato etiqueta="Actor" valor={expediente.actor} />
            <Dato etiqueta="Demandado" valor={expediente.demandado} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documentos</CardTitle>
          <CardDescription>
            {expediente.documentos.length} archivo(s) en el expediente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {expediente.documentos.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileTextIcon />
                </EmptyMedia>
                <EmptyTitle>Sin documentos</EmptyTitle>
                <EmptyDescription>
                  Este expediente aún no tiene archivos cargados.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Archivo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Tamaño</TableHead>
                  <TableHead className="text-right">Cargado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expediente.documentos.map((documento) => (
                  <TableRow key={documento.id}>
                    <TableCell className="font-medium">
                      {documento.nombre}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{documento.tipo}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right">
                      {formatTamano(documento.tamanoBytes)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right">
                      {formatFecha(documento.subidoEn)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
