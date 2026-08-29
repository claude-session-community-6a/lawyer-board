import { useCallback, useState } from "react";
import type { TipoDocumento } from "@/lib/expedientes";

export type UploadEstado = "subiendo" | "listo" | "error";

export interface UploadItem {
  id: string;
  nombre: string;
  tamanoBytes: number;
  tipo: TipoDocumento;
  progreso: number;
  estado: UploadEstado;
  error?: string;
}

const MAX_BYTES = 25 * 1024 * 1024;

/** Guesses a document type from the file name so the lawyer edits less. */
function inferirTipo(nombre: string): TipoDocumento {
  const n = nombre.toLowerCase();
  if (n.includes("demanda")) return "Demanda";
  if (n.includes("contesta")) return "Contestación";
  if (n.includes("poder")) return "Poder notarial";
  if (n.includes("ine") || n.includes("pasaporte") || n.includes("identifica"))
    return "Identificación";
  if (n.includes("contrato") || n.includes("convenio")) return "Contrato";
  if (n.includes("prueba") || n.includes("anexo")) return "Prueba documental";
  return "Otro";
}

function uploadOne(
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("archivo", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`El servidor respondió ${xhr.status}`));
      }
    });
    xhr.addEventListener("error", () =>
      reject(new Error("Falló la conexión durante la carga"))
    );
    xhr.send(body);
  });
}

export function useUploads() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const patch = useCallback((id: string, changes: Partial<UploadItem>) => {
    setUploads((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item))
    );
  }, []);

  const agregar = useCallback(
    (files: File[]) => {
      const nuevos: UploadItem[] = files.map((file, index) => ({
        id: `${file.name}-${file.size}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        nombre: file.name,
        tamanoBytes: file.size,
        tipo: inferirTipo(file.name),
        progreso: 0,
        estado: file.size > MAX_BYTES ? "error" : "subiendo",
        error: file.size > MAX_BYTES ? "Excede el límite de 25 MB" : undefined,
      }));

      setUploads((current) => [...current, ...nuevos]);

      nuevos.forEach((item, index) => {
        if (item.estado === "error") return;
        const file = files[index]!;
        uploadOne(file, (percent) => patch(item.id, { progreso: percent }))
          .then(() => patch(item.id, { estado: "listo", progreso: 100 }))
          .catch((error: Error) =>
            patch(item.id, { estado: "error", error: error.message })
          );
      });
    },
    [patch]
  );

  const quitar = useCallback((id: string) => {
    setUploads((current) => current.filter((item) => item.id !== id));
  }, []);

  const cambiarTipo = useCallback(
    (id: string, tipo: TipoDocumento) => patch(id, { tipo }),
    [patch]
  );

  return { uploads, agregar, quitar, cambiarTipo };
}
