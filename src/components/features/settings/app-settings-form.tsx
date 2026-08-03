"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateAppSettings, type ActionState } from "@/lib/db/actions";
import { AlertTriangleIcon } from "@/components/ui/icons";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-navy px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-navy-deep disabled:opacity-50"
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
      className="flex flex-col gap-3 rounded-lg border border-ink/10 bg-surface p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="limiteNoticiasExibidas" className="text-xs font-medium text-steel">
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
            className="w-28 rounded-md border border-ink/15 bg-surface px-3 py-1.5 text-sm text-ink"
          />
        </div>

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
