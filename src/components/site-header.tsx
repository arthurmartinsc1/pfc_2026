"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GearIcon, ShieldIcon } from "@/components/icons";

export function SiteHeader() {
  const pathname = usePathname();
  const isSettings = pathname === "/configuracoes";

  return (
    <header className="border-b border-slate-800 bg-slate-900">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-300">
            <ShieldIcon className="h-5 w-5" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-white">Sistema de Notícias</span>
            <span className="text-[11px] uppercase tracking-wider text-slate-400">
              Apoio à decisão · Monitoramento
            </span>
          </span>
        </Link>

        {!isSettings && (
          <Link
            href="/configuracoes"
            aria-label="Configurações"
            title="Configurações"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <GearIcon className="h-5 w-5" />
          </Link>
        )}
      </nav>
    </header>
  );
}
