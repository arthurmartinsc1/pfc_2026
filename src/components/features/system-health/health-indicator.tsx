import { formatDateTime } from "@/lib/utils/format";
import { AlertTriangleIcon, CheckCircleIcon, ClockIcon } from "@/components/ui/icons";

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
  // atenção — por isso os três casos usam ícone + cor diferentes, não
  // apenas uma variação de tom da mesma cor.
  if (!hasAnyJob) {
    return (
      <div className="flex items-center gap-2 text-sm text-steel">
        <ClockIcon className="h-4 w-4 shrink-0" />
        Aguardando a primeira execução dos agentes
      </div>
    );
  }

  if (!lastFinishedAt) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-alert">
        <AlertTriangleIcon className="h-4 w-4 shrink-0" />
        Nenhuma busca concluída até o momento
      </div>
    );
  }

  if (isStale) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-alert">
        <AlertTriangleIcon className="h-4 w-4 shrink-0" />
        Última atualização: {formatDateTime(lastFinishedAt)} (sem novas buscas há mais de 24h)
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-success">
      <CheckCircleIcon className="h-4 w-4 shrink-0" />
      Última atualização: {formatDateTime(lastFinishedAt)}
    </div>
  );
}
