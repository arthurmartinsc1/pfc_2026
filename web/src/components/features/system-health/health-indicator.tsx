import { formatDateTime } from "@/lib/utils/format";

export function HealthIndicator({
  lastFinishedAt,
  hasAnyJob,
  isStale,
}: {
  lastFinishedAt: Date | null;
  hasAnyJob: boolean;
  isStale: boolean;
}) {
  // "Nunca rodou ainda" (sistema novo) é neutro; "rodou mas nunca concluiu"
  // ou "está sem novas buscas há muito tempo" é o que de fato merece
  // atenção — por isso os três casos usam indicador + cor diferentes, não
  // apenas uma variação de tom da mesma cor. O ponto de radar pulsa apenas
  // quando o estado é saudável (sistema "vivo"); nos demais fica estático.
  if (!hasAnyJob) {
    return (
      <div className="flex items-center gap-2 text-sm text-sage">
        <span className="radar-dot radar-dot--static" aria-hidden="true" />
        Aguardando a primeira execução dos agentes
      </div>
    );
  }

  if (!lastFinishedAt) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-signal">
        <span className="radar-dot radar-dot--static" aria-hidden="true" />
        Nenhuma busca concluída até o momento
      </div>
    );
  }

  if (isStale) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-signal">
        <span className="radar-dot radar-dot--static" aria-hidden="true" />
        Última atualização: {formatDateTime(lastFinishedAt)} (sem novas buscas há mais de 24h)
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-olive">
      <span className="radar-dot" aria-hidden="true" />
      Última atualização: {formatDateTime(lastFinishedAt)}
    </div>
  );
}
