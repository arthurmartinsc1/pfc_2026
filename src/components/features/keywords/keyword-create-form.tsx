"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createKeyword, type ActionState } from "@/lib/db/actions";
import { AlertTriangleIcon } from "@/components/ui/icons";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-navy px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-navy-deep disabled:opacity-50"
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
      className="flex flex-col gap-3 rounded-lg border border-dashed border-ink/20 p-4 transition-colors hover:border-navy/40"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="new-termo" className="text-xs font-medium text-steel">
            Nova palavra-chave
          </label>
          <input
            id="new-termo"
            type="text"
            name="termo"
            placeholder="ex: Aeronáutica"
            required
            className="rounded-md border border-ink/15 bg-surface px-3 py-1.5 text-sm text-ink"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="new-intervalo" className="text-xs font-medium text-steel">
            Intervalo (min)
          </label>
          <input
            id="new-intervalo"
            type="number"
            name="intervaloMinutos"
            defaultValue={60}
            min={1}
            required
            className="w-28 rounded-md border border-ink/15 bg-surface px-3 py-1.5 text-sm text-ink"
          />
        </div>

        <label className="flex items-center gap-2 pb-1.5 text-sm text-steel">
          <input type="checkbox" name="ativo" defaultChecked className="h-4 w-4 rounded border-ink/20 accent-navy" />
          Ativa
        </label>

        <SubmitButton />
      </div>

      {state.error && (
        <p className="flex items-center gap-1.5 text-xs text-alert">
          <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
          {state.error}
        </p>
      )}
    </form>
  );
}
