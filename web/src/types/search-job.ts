import type { JobStatus, JobOrigin } from "@/generated/prisma/client";

// Formato compartilhado entre KeywordRow e KeywordStatus para exibir a
// execução (search_job) mais recente de uma keyword. Extraído para cá
// porque as duas telas de components/features/keywords precisavam do
// mesmo shape e antes o duplicavam.
export type SearchJobSummary = {
  status: JobStatus;
  origem: JobOrigin;
  startedAt: Date | null;
  finishedAt: Date | null;
  erroMsg: string | null;
  createdAt: Date;
};
