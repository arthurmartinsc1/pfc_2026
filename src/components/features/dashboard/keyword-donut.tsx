import type { KeywordNewsCount } from "@/lib/db/queries";

// Paleta categórica definida em globals.css (um valor por tema, validada
// para CVD e contraste contra --color-panel) — ordem fixa, nunca ciclada; a
// cor segue a keyword pela posição no ranking exibido. Oliva e vermelho-sinal
// do tema ficam de fora de propósito: são reservados a status operacional.
const SERIES_COLORS = Array.from({ length: 6 }, (_, i) => `var(--color-series-${i + 1})`);
// Acima do teto de fatias, a cauda vira "Outras" em cinza neutro — nunca
// gerar mais matizes.
const OTHER_COLOR = "var(--color-series-other)";
const MAX_SLICES = 6;

const RADIUS = 62;
const STROKE = 20;
const SIZE = (RADIUS + STROKE / 2) * 2 + 4;
const CENTER = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// Espaçador de 2px entre fatias adjacentes (spec de marcas).
const GAP = 2;

type Slice = { label: string; total: number; color: string };

function buildSlices(perKeyword: KeywordNewsCount[]): Slice[] {
  if (perKeyword.length <= MAX_SLICES) {
    return perKeyword.map((row, i) => ({
      label: row.termo,
      total: row.total,
      color: SERIES_COLORS[i],
    }));
  }
  const head = perKeyword.slice(0, MAX_SLICES - 1);
  const tail = perKeyword.slice(MAX_SLICES - 1);
  return [
    ...head.map((row, i) => ({ label: row.termo, total: row.total, color: SERIES_COLORS[i] })),
    {
      label: `Outras (${tail.length})`,
      total: tail.reduce((sum, row) => sum + row.total, 0),
      color: OTHER_COLOR,
    },
  ];
}

export function KeywordDonut({
  perKeyword,
  totalNews,
}: {
  perKeyword: KeywordNewsCount[];
  totalNews: number;
}) {
  const slices = buildSlices(perKeyword.filter((row) => row.total > 0));
  const sum = slices.reduce((acc, slice) => acc + slice.total, 0);

  if (sum === 0) {
    return (
      <section className="flex flex-col gap-2 border border-khaki/10 bg-panel p-4">
        <h2 className="text-xs font-medium text-sage">Distribuição por assunto</h2>
        <p className="text-sm text-sage">
          O gráfico aparecerá aqui quando houver notícias vinculadas a assuntos.
        </p>
      </section>
    );
  }

  // Fatia única = anel completo, sem espaçador (não há vizinho de quem se
  // separar). Com 2+, cada fatia cede GAP px ao espaçador.
  const useGap = slices.length > 1;
  const lengths = slices.map((slice) => (slice.total / sum) * CIRCUMFERENCE);
  const segments = slices.map((slice, i) => ({
    ...slice,
    dash: useGap ? Math.max(lengths[i] - GAP, 0.5) : lengths[i],
    dashOffset: -lengths.slice(0, i).reduce((acc, length) => acc + length, 0),
  }));

  return (
    <section className="flex flex-col gap-4 border border-khaki/10 bg-panel p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-xs font-medium text-sage">Distribuição por assunto</h2>
        <p className="text-xs text-sage/80">
          Uma notícia pode contar em mais de um assunto.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          className="donut-svg shrink-0"
          role="img"
          aria-label={`Distribuição de ${totalNews} notícias por assunto`}
        >
          <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
            {segments.map((segment) => (
              <circle
                key={segment.label}
                className="donut-seg"
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={segment.color}
                strokeWidth={STROKE}
                strokeDasharray={`${segment.dash} ${CIRCUMFERENCE - segment.dash}`}
                strokeDashoffset={segment.dashOffset}
              >
                <title>{`${segment.label}: ${segment.total} notícia${segment.total === 1 ? "" : "s"}`}</title>
              </circle>
            ))}
          </g>
          <text
            x={CENTER}
            y={CENTER - 4}
            textAnchor="middle"
            className="pointer-events-none fill-khaki font-display text-3xl font-semibold"
          >
            {totalNews}
          </text>
          <text
            x={CENTER}
            y={CENTER + 16}
            textAnchor="middle"
            className="pointer-events-none fill-sage text-xs"
          >
            notícias
          </text>
        </svg>

        <ul className="flex min-w-[200px] flex-1 flex-col gap-2">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center gap-2.5 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: segment.color }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-khaki">{segment.label}</span>
              <span className="font-mono text-xs tabular-nums text-sage">
                {segment.total} · {Math.round((segment.total / sum) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
