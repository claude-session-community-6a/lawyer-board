import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { UploadCloudIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.tif,.tiff";

export function FileDropzone({
  onFiles,
  disabled,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsOver(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) onFiles(files);
    // Reset so re-picking the same file fires another change event.
    event.target.value = "";
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
      className={cn(
        "border-border flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
        isOver && "border-primary bg-muted/50",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
        <UploadCloudIcon className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">
          Arrastra los documentos del expediente
        </p>
        <p className="text-muted-foreground text-xs">
          PDF, Word o imágenes escaneadas · hasta 25 MB por archivo
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
      >
        Seleccionar archivos
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        onChange={handleChange}
      />
    </div>
  );
}
