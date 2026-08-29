import type { EstadoExpediente } from "@/lib/expedientes";

const fecha = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatFecha(iso: string): string {
  return fecha.format(new Date(iso));
}

export function formatTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function estadoVariant(
  estado: EstadoExpediente
): "default" | "secondary" | "outline" | "destructive" {
  switch (estado) {
    case "Activo":
      return "default";
    case "Borrador":
      return "outline";
    case "Suspendido":
      return "destructive";
    case "Concluido":
      return "secondary";
  }
}
