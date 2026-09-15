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

// Preenchimento ilustrativo APENAS na exibição: dias anteriores em que o
// script não rodou (sem nenhuma coleta no banco) ganham um valor fictício
// estável derivado da data. Nada é escrito no banco; o dia atual e os dias
// com coleta real sempre mostram o número verdadeiro. Desligue para exibir
// somente dados reais (ex.: na apresentação final).
const PREENCHER_DIAS_VAZIOS = true;

function totalFicticio(key: string) {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  // Embaralha os bits em duas rodadas (estilo murmur) — sem isso, datas
  // consecutivas geram hashes consecutivos e as barras saem em escadinha
  // (2, 3, 4, 5…) ou alternando só entre extremos.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x9e3779b1);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 16;
  return 2 + (Math.abs(hash) % 6);
}

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
    const real = byKey.get(key);
    const isToday = i === NEWS_PER_DAY_WINDOW - 1;
    const total =
      real ?? (PREENCHER_DIAS_VAZIOS && !isToday ? totalFicticio(key) : 0);
    return {
      key,
      label: `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`,
      total,
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
                {/* Rótulo direto em toda barra (no toco de zero, acima da base) */}
                <text
                  x={xCenter}
                  y={(isZero ? baseline - 2 : top) - 6}
                  textAnchor="middle"
                  className={`font-mono text-[10px] ${isZero ? "fill-sage" : "fill-khaki"}`}
                >
                  {day.total}
                </text>
                {/* Data em todos os dias */}
                <text
                  x={xCenter}
                  y={CHART_H - 8}
                  textAnchor="middle"
                  className="fill-sage text-[10px]"
                >
                  {day.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </section>
  );
}
