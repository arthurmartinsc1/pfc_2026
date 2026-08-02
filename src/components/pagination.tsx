import Link from "next/link";

export function Pagination({
  page,
  pageCount,
  buildHref,
}: {
  page: number;
  pageCount: number;
  buildHref: (page: number) => string;
}) {
  if (pageCount <= 1) return null;

  const hasPrevious = page > 1;
  const hasNext = page < pageCount;

  return (
    <nav className="flex items-center justify-center gap-4 text-sm">
      {hasPrevious ? (
        <Link href={buildHref(page - 1)} className="text-slate-600 hover:text-indigo-600 hover:underline">
          ← Anterior
        </Link>
      ) : (
        <span className="text-slate-300">← Anterior</span>
      )}

      <span className="text-slate-500">
        Página {page} de {pageCount}
      </span>

      {hasNext ? (
        <Link href={buildHref(page + 1)} className="text-slate-600 hover:text-indigo-600 hover:underline">
          Próxima →
        </Link>
      ) : (
        <span className="text-slate-300">Próxima →</span>
      )}
    </nav>
  );
}
