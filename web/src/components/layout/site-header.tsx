"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { GearIcon, ShieldIcon } from "@/components/ui/icons";

export function SiteHeader() {
  const pathname = usePathname();
  const isSettings = pathname === "/configuracoes";

  return (
    <header className="sticky top-0 z-10 border-b border-khaki/10 bg-panel/95 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-brass/40 bg-brass/10 text-brass">
            <ShieldIcon className="h-5 w-5" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-lg font-semibold uppercase tracking-wider text-khaki">
              Sistema de Notícias
            </span>
            <span className="text-xs text-sage">
              Apoio à decisão · Monitoramento
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {!isSettings && (
            <Link
              href="/configuracoes"
              className="flex items-center gap-2 rounded-sm border border-khaki/15 px-3 py-1.5 text-sm text-sage transition-colors hover:border-brass/50 hover:bg-khaki/5 hover:text-khaki"
            >
              <GearIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Configurações</span>
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
