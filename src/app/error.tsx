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
        <AlertTriangleIcon className="h-6 w-6 text-alert" />
        <p className="font-heading text-lg font-semibold text-ink">
          Algo deu errado ao carregar esta página.
        </p>
        <p className="text-sm text-steel">
          Verifique se o banco de dados está acessível e tente novamente. Se o problema
          persistir, procure o responsável pelo sistema.
        </p>
        {error.message && (
          <p className="rounded-md bg-ink/5 px-3 py-1.5 text-xs text-steel">{error.message}</p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-2 rounded-md bg-navy px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-navy-deep"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
