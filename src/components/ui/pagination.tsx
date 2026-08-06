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
        <Link
          href={buildHref(page - 1)}
          className="text-khaki transition-colors hover:text-brass-bright hover:underline"
        >
          ← Anterior
        </Link>
      ) : (
        <span className="text-khaki/30">← Anterior</span>
      )}

      <span className="text-xs tabular-nums text-sage">
        Página {page} de {pageCount}
      </span>

      {hasNext ? (
        <Link
          href={buildHref(page + 1)}
          className="text-khaki transition-colors hover:text-brass-bright hover:underline"
        >
          Próxima →
        </Link>
      ) : (
        <span className="text-khaki/30">Próxima →</span>
      )}
    </nav>
  );
}
