"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { APP_SETTINGS_ID } from "@/lib/db/queries";

export type ActionState = { error?: string };

export async function discardNewsItem(id: string) {
  await prisma.newsItem.update({
    where: { id },
    data: { descartada: true },
  });
  revalidatePath("/");
}

function parseKeywordForm(formData: FormData): {
  data?: { termo: string; intervaloMinutos: number; ativo: boolean };
  error?: string;
} {
  const termo = String(formData.get("termo") ?? "").trim();
  const intervaloMinutos = Number(formData.get("intervaloMinutos"));
  const ativo = formData.get("ativo") === "on";

  if (!termo) {
    return { error: "Informe o assunto." };
  }
  if (!Number.isFinite(intervaloMinutos) || intervaloMinutos <= 0) {
    return { error: "Informe um intervalo de busca válido, em minutos." };
  }

  return { data: { termo, intervaloMinutos, ativo } };
}

// Termos relacionados são editados apenas na página dedicada do assunto
// (/configuracoes/assuntos/[id]) e salvos de uma vez no submit — nunca
// pelo formulário da tabela, que por isso não toca nesse campo.
export async function updateKeywordTerms(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // O input de tags envia um hidden por termo (mesmo name) — getAll cobre
  // zero, um ou vários. Dedup preservando a ordem de digitação.
  const termosRelacionados = Array.from(
    new Set(
      formData
        .getAll("termosRelacionados")
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  );

  await prisma.keyword.update({ where: { id }, data: { termosRelacionados } });
  revalidatePath("/configuracoes");
  revalidatePath(`/configuracoes/assuntos/${id}`);
  revalidatePath("/");
  return {};
}

export async function createKeyword(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = parseKeywordForm(formData);
  if (parsed.error) return { error: parsed.error };

  await prisma.keyword.create({ data: parsed.data! });
  revalidatePath("/configuracoes");
  return {};
}

export async function updateKeyword(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = parseKeywordForm(formData);
  if (parsed.error) return { error: parsed.error };

  await prisma.keyword.update({ where: { id }, data: parsed.data! });
  revalidatePath("/configuracoes");
  revalidatePath("/");
  return {};
}

export async function deleteKeyword(
  id: string,
  _prevState: ActionState
): Promise<ActionState> {
  // Só permite excluir quando não há histórico de execuções associado —
  // mantém a integridade referencial com search_jobs/news_keyword_matches
  // (FK RESTRICT). Para uma keyword com histórico, o caminho é desativá-la
  // pelo toggle "ativo", não excluir.
  const jobCount = await prisma.searchJob.count({ where: { keywordId: id } });
  if (jobCount > 0) {
    return {
      error:
        "Não é possível excluir: esse assunto já tem execuções associadas. Desative-o em vez de excluir.",
    };
  }
  await prisma.keyword.delete({ where: { id } });
  revalidatePath("/configuracoes");
  return {};
}

export async function updateAppSettings(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const limiteNoticiasExibidas = Number(formData.get("limiteNoticiasExibidas"));

  if (!Number.isFinite(limiteNoticiasExibidas) || limiteNoticiasExibidas <= 0) {
    return { error: "Informe um limite de notícias válido." };
  }

  await prisma.appSettings.upsert({
    where: { id: APP_SETTINGS_ID },
    create: { id: APP_SETTINGS_ID, limiteNoticiasExibidas },
    update: { limiteNoticiasExibidas },
  });
  revalidatePath("/configuracoes");
  revalidatePath("/");
  return {};
}
