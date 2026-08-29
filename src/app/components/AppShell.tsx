import type { ReactNode } from "react";
import { Link, useRoute } from "wouter";
import { FolderOpenIcon, PlusIcon, ScaleIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
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
  const [isActive] = useRoute(href);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      <Icon className="size-4" />
      {children}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-6">
      <header className="flex items-center justify-between gap-4 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <ScaleIcon className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Despacho · Expedientes
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink href="/expedientes" icon={FolderOpenIcon}>
            Expedientes
          </NavLink>
          <Link
            href="/expedientes/nuevo"
            className={buttonVariants({ size: "sm" })}
          >
            <PlusIcon data-icon="inline-start" />
            Nuevo
          </Link>
        </nav>
      </header>

      <Separator />

      <main className="flex-1 py-8">{children}</main>
    </div>
  );
}
