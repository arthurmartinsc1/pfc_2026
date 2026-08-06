"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deleteKeyword, updateKeyword, type ActionState } from "@/lib/db/actions";
import { KeywordStatus } from "@/components/features/keywords/keyword-status";
import { AlertTriangleIcon } from "@/components/ui/icons";
import { TagsInput } from "@/components/ui/tags-input";
import type { SearchJobSummary } from "@/types/search-job";

// Definido como estilo inline (não classe utilitária) para garantir que o
// cabeçalho (keyword-table.tsx) e cada linha usem exatamente as mesmas
// trilhas de coluna, sem depender da geração de uma classe Tailwind
// arbitrária compartilhada entre arquivos.
export const KEYWORD_TABLE_COLUMNS =
  "minmax(150px,1.5fr) minmax(200px,2fr) 110px 70px minmax(170px,1.5fr) 150px";

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

function DeleteButton({ deleteAction }: { deleteAction: (formData: FormData) => void }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={deleteAction}
      disabled={pending}
      className="border border-signal/40 px-3 py-1.5 text-xs font-medium text-signal transition-colors hover:bg-signal/10 disabled:opacity-50"
    >
      Excluir
    </button>
  );
}

export function KeywordRow({ keyword }: { keyword: KeywordRowData }) {
  const updateWithId = updateKeyword.bind(null, keyword.id);
  const deleteWithId = deleteKeyword.bind(null, keyword.id);
  const canDelete = keyword._count.searchJobs === 0;

  const [updateState, updateFormAction] = useActionState<ActionState, FormData>(
    updateWithId,
    {}
  );
  const [deleteState, deleteFormAction] = useActionState<ActionState, FormData>(
    deleteWithId,
    {}
  );

  const error = updateState.error || deleteState.error;

  return (
    <form action={updateFormAction} className="transition-colors hover:bg-khaki/[0.03]">
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

        <TagsInput
          name="termosRelacionados"
          initialTags={keyword.termosRelacionados}
          placeholder="ex: drone, OTAN…"
        />

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

        <div className="flex justify-end gap-2">
          <SaveButton />
          {canDelete && <DeleteButton deleteAction={deleteFormAction} />}
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 px-4 pb-3 text-xs text-signal">
          <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </form>
  );
}
