"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-16">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <p className="text-base font-semibold text-slate-900">
          Algo deu errado ao carregar esta página.
        </p>
        <p className="text-sm text-slate-500">
          Verifique se o banco de dados está acessível e tente novamente. Se o problema
          persistir, procure o responsável pelo sistema.
        </p>
        {error.message && (
          <p className="rounded-md bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
            {error.message}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-2 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
