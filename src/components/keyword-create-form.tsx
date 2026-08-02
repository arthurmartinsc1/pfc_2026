"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createKeyword, type ActionState } from "@/lib/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
    >
      {pending ? "Adicionando…" : "Adicionar"}
    </button>
  );
}

export function KeywordCreateForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(createKeyword, {});

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-dashed border-slate-300 p-4 transition-colors hover:border-indigo-300"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="new-termo" className="text-xs font-medium text-slate-500">
            Nova palavra-chave
          </label>
          <input
            id="new-termo"
            type="text"
            name="termo"
            placeholder="ex: Aeronáutica"
            required
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="new-intervalo" className="text-xs font-medium text-slate-500">
            Intervalo (min)
          </label>
          <input
            id="new-intervalo"
            type="number"
            name="intervaloMinutos"
            defaultValue={60}
            min={1}
            required
            className="w-28 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        <label className="flex items-center gap-2 pb-1.5 text-sm text-slate-600">
          <input type="checkbox" name="ativo" defaultChecked />
          Ativa
        </label>

        <SubmitButton />
      </div>

      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
