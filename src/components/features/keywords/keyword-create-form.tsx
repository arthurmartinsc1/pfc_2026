"use client";

import { useFormStatus } from "react-dom";
import { createKeyword } from "@/lib/db/actions";
import { useToast } from "@/components/ui/toast";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-brass bg-brass px-4 py-1.5 text-sm font-semibold text-command transition-colors hover:border-brass-bright hover:bg-brass-bright disabled:opacity-50"
    >
      {pending ? "Adicionando…" : "Adicionar"}
    </button>
  );
}

export function KeywordCreateForm() {
  const toast = useToast();

  async function handleAction(formData: FormData) {
    const result = await createKeyword({}, formData);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    toast("Assunto adicionado — complete as palavras-chave no menu ⋯ da tabela", "success", 6000);
  }

  return (
    <form
      action={handleAction}
      className="flex flex-col gap-3 border border-dashed border-khaki/20 p-4 transition-colors hover:border-brass/50"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="new-termo" className="text-xs font-medium text-sage">
            Novo assunto
          </label>
          <input
            id="new-termo"
            type="text"
            name="termo"
            placeholder="ex: Guerra na Ucrânia"
            required
            className="border border-khaki/15 bg-panel-raised px-3 py-1.5 text-sm text-khaki placeholder:text-sage/50 transition-colors focus:border-brass/60"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="new-intervalo" className="text-xs font-medium text-sage">
            Intervalo (min)
          </label>
          <input
            id="new-intervalo"
            type="number"
            name="intervaloMinutos"
            defaultValue={60}
            min={1}
            required
            className="w-28 border border-khaki/15 bg-panel-raised px-3 py-1.5 font-mono text-sm text-khaki transition-colors focus:border-brass/60"
          />
        </div>

        <label className="flex items-center gap-2 pb-1.5 text-sm text-sage">
          <input
            type="checkbox"
            name="ativo"
            defaultChecked
            className="h-4 w-4 border-khaki/20 accent-brass"
          />
          Ativa
        </label>

        <SubmitButton />
      </div>

      <p className="text-xs text-sage/80">
        Os termos relacionados do assunto são adicionados depois, na página do assunto (⋯ na
        tabela).
      </p>
    </form>
  );
}
