"use client";

import { AlertTriangleIcon } from "@/components/ui/icons";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <AlertTriangleIcon className="h-6 w-6 text-signal" />
        <p className="font-display text-xl font-semibold text-khaki">
          Algo deu errado ao carregar esta página.
        </p>
        <p className="text-sm text-sage">
          Verifique se o banco de dados está acessível e tente novamente. Se o problema
          persistir, procure o responsável pelo sistema.
        </p>
        {error.message && (
          <p className="border border-khaki/10 bg-panel px-3 py-1.5 font-mono text-xs text-sage">
            {error.message}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-2 border border-brass bg-brass px-4 py-1.5 text-sm font-semibold text-command transition-colors hover:border-brass-bright hover:bg-brass-bright"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
