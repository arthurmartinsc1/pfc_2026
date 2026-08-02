"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateAppSettings, type ActionState } from "@/lib/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
    >
      {pending ? "Salvando…" : "Salvar"}
    </button>
  );
}

export function AppSettingsForm({ limiteNoticiasExibidas }: { limiteNoticiasExibidas: number }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateAppSettings, {});

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="limiteNoticiasExibidas" className="text-xs font-medium text-slate-500">
            Notícias exibidas por página
          </label>
          <input
            id="limiteNoticiasExibidas"
            type="number"
            name="limiteNoticiasExibidas"
            defaultValue={limiteNoticiasExibidas}
            min={1}
            max={100}
            required
            className="w-28 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        <SubmitButton />
      </div>

      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
