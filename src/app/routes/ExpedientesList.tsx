import { Link, useSearchParams } from "wouter";
import { FolderOpenIcon, PlusIcon, SearchIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import { useStore } from "../store";
import { estadoVariant, formatFecha } from "../format";

export function ExpedientesList() {
  const { expedientes } = useStore();
  // Seeded from Astro.url.search on the server, then owned by the client.
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const term = q.trim().toLowerCase();
  const visibles = term
    ? expedientes.filter((e) =>
        [e.numero, e.caratula, e.cliente, e.materia, e.juzgado]
          .join(" ")
          .toLowerCase()
          .includes(term)
      )
    : expedientes;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Expedientes</h1>
          <p className="text-muted-foreground text-sm">
            {expedientes.length} expedientes en el despacho.
          </p>
        </div>
        <div className="relative">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={q}
            placeholder="Buscar por número, carátula o cliente"
            className="w-72 pl-8"
            onChange={(event) => {
              const next = event.target.value;
              setSearchParams(
                next ? { q: next } : {},
                { replace: true }
              );
            }}
          />
        </div>
      </div>

      {visibles.length === 0 ? (
        <Empty className="border-border rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderOpenIcon />
            </EmptyMedia>
            <EmptyTitle>Sin resultados</EmptyTitle>
            <EmptyDescription>
              Ningún expediente coincide con “{q}”. Ajusta la búsqueda o crea uno
              nuevo.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              href="/expedientes/nuevo"
              className={buttonVariants()}
            >
              <PlusIcon data-icon="inline-start" />
              Nuevo expediente
            </Link>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="border-border overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Carátula</TableHead>
                <TableHead>Materia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Alta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((expediente) => (
                <TableRow key={expediente.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/expedientes/${expediente.id}`}
                      className="hover:underline"
                    >
                      {expediente.numero}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {expediente.caratula}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{expediente.materia}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={estadoVariant(expediente.estado)}>
                      {expediente.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right">
                    {formatFecha(expediente.creadoEn)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
