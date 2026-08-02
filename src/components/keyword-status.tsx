const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

type LatestJob = {
  status: "pendente" | "rodando" | "concluido" | "erro";
  origem: "agendado" | "manual";
  startedAt: Date | null;
  finishedAt: Date | null;
  erroMsg: string | null;
  createdAt: Date;
};

export function KeywordStatus({ latestJob }: { latestJob: LatestJob | undefined }) {
  if (!latestJob) {
    return <span className="text-xs text-slate-400">Nunca executado</span>;
  }

  if (latestJob.status === "concluido") {
    return (
      <span className="text-xs text-emerald-700">
        Concluído em {latestJob.finishedAt ? dateTimeFormatter.format(latestJob.finishedAt) : "—"}
      </span>
    );
  }

  if (latestJob.status === "erro") {
    return (
      <span className="text-xs text-red-700">
        Erro em {latestJob.finishedAt ? dateTimeFormatter.format(latestJob.finishedAt) : "—"}
        {latestJob.erroMsg && `: ${latestJob.erroMsg}`}
      </span>
    );
  }

  if (latestJob.status === "rodando") {
    return (
      <span className="text-xs text-blue-700">
        Em execução desde{" "}
        {latestJob.startedAt ? dateTimeFormatter.format(latestJob.startedAt) : "—"}
      </span>
    );
  }

  return (
    <span className="text-xs text-slate-500">
      Pendente desde {dateTimeFormatter.format(latestJob.createdAt)}
    </span>
  );
}
