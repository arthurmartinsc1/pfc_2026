"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { deleteKeyword, updateKeyword } from "@/lib/db/actions";
import { KeywordStatus } from "@/components/features/keywords/keyword-status";
import { EllipsisIcon, TrashIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import type { SearchJobSummary } from "@/types/search-job";

// Definido como estilo inline (não classe utilitária) para garantir que o
// cabeçalho (keyword-table.tsx) e cada linha usem exatamente as mesmas
// trilhas de coluna, sem depender da geração de uma classe Tailwind
// arbitrária compartilhada entre arquivos.
export const KEYWORD_TABLE_COLUMNS =
  "minmax(150px,1.5fr) minmax(180px,1.5fr) 110px 70px minmax(170px,1.5fr) 190px";

export type KeywordRowData = {
  id: string;
  termo: string;
  ativo: boolean;
  intervaloMinutos: number;
  termosRelacionados: string[];
  searchJobs: SearchJobSummary[];
  _count: { searchJobs: number };
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-brass bg-brass px-3 py-1.5 text-xs font-semibold text-command transition-colors hover:border-brass-bright hover:bg-brass-bright disabled:opacity-50"
    >
      {pending ? "Salvando…" : "Salvar"}
    </button>
  );
}

function DeleteButton({
  deleteAction,
  termo,
}: {
  deleteAction: (formData: FormData) => void;
  termo: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={deleteAction}
      disabled={pending}
      aria-label={`Excluir assunto ${termo}`}
      title="Excluir assunto"
      onClick={(event) => {
        if (!window.confirm(`Excluir o assunto "${termo}"?`)) {
          event.preventDefault();
        }
      }}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-signal/40 text-signal transition-colors hover:bg-signal/10 disabled:opacity-50"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}

export function KeywordRow({ keyword }: { keyword: KeywordRowData }) {
  const toast = useToast();

  async function handleUpdate(formData: FormData) {
    const result = await updateKeyword(keyword.id, {}, formData);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    toast("Assunto salvo com sucesso");
  }

  async function handleDelete() {
    const result = await deleteKeyword(keyword.id, {});
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    toast("Assunto excluído");
  }

  return (
    <form action={handleUpdate} className="transition-colors hover:bg-khaki/[0.03]">
      <div
        className="grid items-center gap-4 px-4 py-3"
        style={{ gridTemplateColumns: KEYWORD_TABLE_COLUMNS }}
      >
        <input
          type="text"
          name="termo"
          defaultValue={keyword.termo}
          required
          className="w-full min-w-0 border border-khaki/15 bg-panel-raised px-2.5 py-1.5 text-sm text-khaki transition-colors focus:border-brass/60"
        />

        {/* Somente leitura — a edição dos termos acontece na página do
            assunto (botão ⋯ nas ações). */}
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {keyword.termosRelacionados.length === 0 ? (
            <span className="text-xs text-sage/60">—</span>
          ) : (
            <>
              {keyword.termosRelacionados.slice(0, 3).map((termo) => (
                <span
                  key={termo}
                  className="max-w-[110px] truncate rounded-sm border border-khaki/15 px-1.5 py-0.5 text-xs text-sage"
                >
                  {termo}
                </span>
              ))}
              {keyword.termosRelacionados.length > 3 && (
                <span className="text-xs text-sage/70">
                  +{keyword.termosRelacionados.length - 3}
                </span>
              )}
            </>
          )}
        </div>

        <input
          type="number"
          name="intervaloMinutos"
          defaultValue={keyword.intervaloMinutos}
          min={1}
          required
          className="w-full min-w-0 border border-khaki/15 bg-panel-raised px-2.5 py-1.5 font-mono text-sm text-khaki transition-colors focus:border-brass/60"
        />

        <div className="flex justify-center">
          <input
            type="checkbox"
            name="ativo"
            defaultChecked={keyword.ativo}
            aria-label="Assunto ativo"
            className="h-4 w-4 border-khaki/20 accent-brass"
          />
        </div>

        <KeywordStatus latestJob={keyword.searchJobs[0]} />

        <div className="flex items-center justify-end gap-2">
          <SaveButton />
          <DeleteButton deleteAction={handleDelete} termo={keyword.termo} />
          <Link
            href={`/configuracoes/assuntos/${keyword.id}`}
            aria-label={`Gerenciar termos relacionados de ${keyword.termo}`}
            title="Termos relacionados"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-khaki/15 text-sage transition-colors hover:border-brass/50 hover:text-khaki"
          >
            <EllipsisIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </form>
  );
}
