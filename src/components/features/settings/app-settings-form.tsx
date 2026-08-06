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
      className="border border-brass bg-brass px-4 py-1.5 text-sm font-semibold text-command transition-colors hover:border-brass-bright hover:bg-brass-bright disabled:opacity-50"
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
      className="flex flex-col gap-3 border border-khaki/10 bg-panel p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="limiteNoticiasExibidas"
            className="text-xs font-medium text-sage"
          >
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
            className="w-28 border border-khaki/15 bg-panel-raised px-3 py-1.5 font-mono text-sm text-khaki transition-colors focus:border-brass/60"
          />
        </div>

        <SubmitButton />
      </div>

      {state.error && (
        <p className="flex items-center gap-1.5 text-xs text-signal">
          <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
          {state.error}
        </p>
      )}
    </form>
  );
}
