import { NEWS_PER_DAY_WINDOW, type NewsPerDay } from "@/lib/db/queries";

// Série única de magnitude → um matiz só (o latão do tema), sem legenda —
// o título nomeia a série. Barras finas ancoradas na linha de base, topo
// arredondado, 2px de respiro entre vizinhas; rótulo direto apenas no pico
// (rotular todo ponto é ruído).
const BAR_COLOR = "#d3ae57";
const ZERO_COLOR = "rgb(176 183 160 / 0.25)";

const CHART_W = 560;
const CHART_H = 170;
const PAD_TOP = 20;
const PAD_BOTTOM = 24;
const PAD_X = 6;
const TOP_RADIUS = 2;
const MAX_BAR_W = 24;

type Day = { key: string; label: string; total: number };

// Últimos N dias no fuso local, preenchendo com zero os dias sem coleta.
function buildDays(rows: NewsPerDay[]): Day[] {
  const byKey = new Map(rows.map((row) => [row.dia, row.total]));
  return Array.from({ length: NEWS_PER_DAY_WINDOW }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (NEWS_PER_DAY_WINDOW - 1 - i));
    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    return {
      key,
      label: `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`,
      total: byKey.get(key) ?? 0,
    };
  });
}

// Barra com topo arredondado e base reta (ancorada na linha de base).
function barPath(x: number, width: number, top: number, baseline: number) {
  const r = Math.min(TOP_RADIUS, (baseline - top) / 2, width / 2);
  return [
    `M ${x} ${baseline}`,
    `V ${top + r}`,
    `Q ${x} ${top} ${x + r} ${top}`,
    `H ${x + width - r}`,
    `Q ${x + width} ${top} ${x + width} ${top + r}`,
    `V ${baseline}`,
    "Z",
  ].join(" ");
}

export function NewsPerDayChart({ perDay }: { perDay: NewsPerDay[] }) {
  const days = buildDays(perDay);
  const max = Math.max(...days.map((day) => day.total));
  const peakIndex = days.findIndex((day) => day.total === max);

  const baseline = CHART_H - PAD_BOTTOM;
  const innerH = baseline - PAD_TOP;
  const slot = (CHART_W - PAD_X * 2) / days.length;
  const barW = Math.min(slot - 2, MAX_BAR_W);

  return (
    <section className="flex flex-col gap-4 border border-khaki/10 bg-panel p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-xs font-medium text-sage">Notícias por dia</h2>
        <p className="text-xs text-sage/80">Últimos {NEWS_PER_DAY_WINDOW} dias</p>
      </div>

      {max === 0 ? (
        <p className="text-sm text-sage">
          Nenhuma notícia coletada nos últimos {NEWS_PER_DAY_WINDOW} dias.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="bars-svg w-full"
          role="img"
          aria-label={`Notícias coletadas por dia nos últimos ${NEWS_PER_DAY_WINDOW} dias`}
        >
          {/* Linha de base recessiva */}
          <line
            x1={PAD_X}
            y1={baseline}
            x2={CHART_W - PAD_X}
            y2={baseline}
            stroke="rgb(242 239 226 / 0.15)"
            strokeWidth="1"
          />

          {days.map((day, i) => {
            const xCenter = PAD_X + slot * i + slot / 2;
            const x = xCenter - barW / 2;
            const height = (day.total / max) * innerH;
            const top = baseline - height;
            // Dia sem coleta: toco de 2px para mostrar que o dia existe,
            // distinto de "sem dado".
            const isZero = day.total === 0;
            return (
              <g key={day.key} className="bar">
                {isZero ? (
                  <rect x={x} y={baseline - 2} width={barW} height={2} fill={ZERO_COLOR} />
                ) : (
                  <path d={barPath(x, barW, top, baseline)} fill={BAR_COLOR} />
                )}
                {/* Alvo de hover maior que a marca (coluna inteira) */}
                <rect
                  x={PAD_X + slot * i}
                  y={PAD_TOP}
                  width={slot}
                  height={innerH + PAD_BOTTOM}
                  fill="transparent"
                >
                  <title>{`${day.label}: ${day.total} notícia${day.total === 1 ? "" : "s"}`}</title>
                </rect>
                {/* Rótulo direto apenas no pico */}
                {i === peakIndex && (
                  <text
                    x={xCenter}
                    y={top - 6}
                    textAnchor="middle"
                    className="fill-khaki font-mono text-[11px]"
                  >
                    {day.total}
                  </text>
                )}
                {/* Datas em dias alternados, garantindo o último */}
                {i % 2 === (days.length - 1) % 2 && (
                  <text
                    x={xCenter}
                    y={CHART_H - 8}
                    textAnchor="middle"
                    className="fill-sage text-[10px]"
                  >
                    {day.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </section>
  );
}
