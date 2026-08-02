const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function HealthIndicator({
  lastFinishedAt,
  hasAnyJob,
  isStale,
}: {
  lastFinishedAt: Date | null;
  hasAnyJob: boolean;
  isStale: boolean;
}) {
  if (!lastFinishedAt) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-700">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        {hasAnyJob
          ? "Nenhuma busca concluída até o momento"
          : "Aguardando a primeira execução dos agentes"}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 text-sm ${
        isStale ? "text-amber-700" : "text-emerald-700"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${isStale ? "bg-amber-500" : "bg-emerald-500"}`}
      />
      Última atualização: {dateTimeFormatter.format(lastFinishedAt)}
      {isStale && " (sem novas buscas há mais de 24h)"}
    </div>
  );
}
