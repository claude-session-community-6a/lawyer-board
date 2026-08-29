const fechaLarga = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const horaCorta = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Acepta `YYYY-MM-DD` e ISO completo; ambos se leen en UTC para no correr un día. */
export function formatFecha(valor: string): string {
  if (!valor) return "—";
  const fecha = new Date(valor.length === 10 ? `${valor}T00:00:00Z` : valor);
  return Number.isNaN(fecha.getTime()) ? valor : fechaLarga.format(fecha);
}

export function formatFechaHora(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? iso : horaCorta.format(fecha);
}

export function formatTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** `01.-`, `02.-` … la numeración de la casa la asigna el sistema. */
export function consecutivo(n: number): string {
  return `${String(n).padStart(2, "0")}.-`;
}

export function porcentaje(valor: number): string {
  return `${Math.round(valor * 100)}%`;
}
