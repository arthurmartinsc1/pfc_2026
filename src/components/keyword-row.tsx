"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deleteKeyword, updateKeyword, type ActionState } from "@/lib/actions";
import { KeywordStatus } from "@/components/keyword-status";

// Definido como estilo inline (não classe utilitária) para garantir que o
// cabeçalho (keyword-table.tsx) e cada linha usem exatamente as mesmas
// trilhas de coluna, sem depender da geração de uma classe Tailwind
// arbitrária compartilhada entre arquivos.
export const KEYWORD_TABLE_COLUMNS = "minmax(160px,2fr) 110px 70px minmax(180px,1.5fr) 150px";

type LatestJob = {
  status: "pendente" | "rodando" | "concluido" | "erro";
  origem: "agendado" | "manual";
  startedAt: Date | null;
  finishedAt: Date | null;
  erroMsg: string | null;
  createdAt: Date;
};

export type KeywordRowData = {
  id: string;
  termo: string;
  ativo: boolean;
  intervaloMinutos: number;
  searchJobs: LatestJob[];
  _count: { searchJobs: number };
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
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
      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
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
    <form action={updateFormAction} className="transition-colors hover:bg-slate-50">
      <div
        className="grid items-center gap-4 px-4 py-3"
        style={{ gridTemplateColumns: KEYWORD_TABLE_COLUMNS }}
      >
        <input
          type="text"
          name="termo"
          defaultValue={keyword.termo}
          required
          className="w-full min-w-0 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />

        <input
          type="number"
          name="intervaloMinutos"
          defaultValue={keyword.intervaloMinutos}
          min={1}
          required
          className="w-full min-w-0 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />

        <div className="flex justify-center">
          <input
            type="checkbox"
            name="ativo"
            defaultChecked={keyword.ativo}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        <KeywordStatus latestJob={keyword.searchJobs[0]} />

        <div className="flex justify-end gap-2">
          <SaveButton />
          {canDelete && <DeleteButton deleteAction={deleteFormAction} />}
        </div>
      </div>

      {error && <p className="px-4 pb-3 text-xs text-red-600">{error}</p>}
    </form>
  );
}
