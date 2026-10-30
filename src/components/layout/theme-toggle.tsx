"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "@/components/ui/icons";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/utils/theme";

// A fonte da verdade do tema é o atributo no <html> (escrito antes do
// primeiro paint pelo script em lib/utils/theme.ts), não um estado do React.
// Lemos esse sistema externo com useSyncExternalStore para que o rótulo do
// botão acompanhe o atributo sem divergir da hidratação.
function subscribeTema(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function lerTema(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

// Durante a hidratação vale o padrão do CSS; o valor real entra no primeiro
// commit no cliente.
const TEMA_SSR: Theme = "dark";

export function ThemeToggle() {
  const tema = useSyncExternalStore(subscribeTema, lerTema, () => TEMA_SSR);

  // Enquanto o usuário não escolher explicitamente, acompanhamos o sistema em
  // tempo real (ex.: macOS alternando claro/escuro ao anoitecer).
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (event: MediaQueryListEvent) => {
      try {
        if (localStorage.getItem(THEME_STORAGE_KEY)) return;
      } catch {
        return;
      }
      document.documentElement.dataset.theme = event.matches ? "light" : "dark";
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const alternar = useCallback(() => {
    const proximo: Theme = lerTema() === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = proximo;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, proximo);
    } catch {
      /* localStorage bloqueado (modo privado): vale só para esta sessão. */
    }
  }, []);

  const rotulo = tema === "light" ? "Ativar tema escuro" : "Ativar tema claro";

  return (
    <button
      type="button"
      onClick={alternar}
      title={rotulo}
      aria-label={rotulo}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-khaki/15 text-sage transition-colors hover:border-brass/50 hover:bg-khaki/5 hover:text-khaki"
    >
      {/* Ícones trocados por CSS (globals.css): já saem certos no 1º paint. */}
      <SunIcon className="theme-icon-to-light h-4 w-4" />
      <MoonIcon className="theme-icon-to-dark h-4 w-4" />
    </button>
  );
}
