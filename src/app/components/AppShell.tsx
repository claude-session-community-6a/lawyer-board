import type { ReactNode } from "react";
import { Link, useRoute } from "wouter";
import { BookOpenIcon, FolderOpenIcon, LayoutDashboardIcon, ScaleIcon } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

function NavLink({
  href,
  children,
  icon: Icon,
}: {
  href: string;
  children: ReactNode;
  icon: typeof FolderOpenIcon;
}) {
  const [exacto] = useRoute(href);
  const [anidado] = useRoute(`${href}/*`);
  const activo = exacto || anidado;

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
        activo
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {children}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <ScaleIcon className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Ávila &amp; Miranda · Juicios laborales
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink href="/" icon={LayoutDashboardIcon}>
            Tablero
          </NavLink>
          <NavLink href="/expedientes" icon={FolderOpenIcon}>
            Expedientes
          </NavLink>
          <NavLink href="/biblioteca" icon={BookOpenIcon}>
            Biblioteca
          </NavLink>
        </nav>
      </header>

      <Separator />

      <main className="flex-1 py-8">{children}</main>
    </div>
  );
}
