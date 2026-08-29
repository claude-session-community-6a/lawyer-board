import { Link, useLocation } from "wouter";
import { FileQuestionIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function NoEncontrado() {
  const [location] = useLocation();

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileQuestionIcon />
        </EmptyMedia>
        <EmptyTitle>Ruta no encontrada</EmptyTitle>
        <EmptyDescription>
          No hay nada en <code>{location}</code>.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link href="/expedientes" className={buttonVariants()}>
          Ir a expedientes
        </Link>
      </EmptyContent>
    </Empty>
  );
}
