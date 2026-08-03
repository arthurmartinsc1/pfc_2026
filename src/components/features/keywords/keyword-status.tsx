import { formatDateTime } from "@/lib/utils/format";
import { AlertTriangleIcon, CheckCircleIcon, ClockIcon } from "@/components/ui/icons";
import type { SearchJobSummary } from "@/types/search-job";

export function KeywordStatus({ latestJob }: { latestJob: SearchJobSummary | undefined }) {
  if (!latestJob) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-steel">
        <ClockIcon className="h-3.5 w-3.5 shrink-0" />
        Nunca executado
      </span>
    );
  }

  if (latestJob.status === "concluido") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-success">
        <CheckCircleIcon className="h-3.5 w-3.5 shrink-0" />
        Concluído em {latestJob.finishedAt ? formatDateTime(latestJob.finishedAt) : "—"}
      </span>
    );
  }

  if (latestJob.status === "erro") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-alert">
        <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
        Erro em {latestJob.finishedAt ? formatDateTime(latestJob.finishedAt) : "—"}
        {latestJob.erroMsg && `: ${latestJob.erroMsg}`}
      </span>
    );
  }

  if (latestJob.status === "rodando") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-navy">
        <ClockIcon className="h-3.5 w-3.5 shrink-0" />
        Em execução desde{" "}
        {latestJob.startedAt ? formatDateTime(latestJob.startedAt) : "—"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-steel">
      <ClockIcon className="h-3.5 w-3.5 shrink-0" />
      Pendente desde {formatDateTime(latestJob.createdAt)}
    </span>
  );
}
