"use client";

import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { updateKeywordTerms } from "@/lib/db/actions";
import { TagsInput } from "@/components/ui/tags-input";
import { useToast } from "@/components/ui/toast";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start border border-brass bg-brass px-4 py-1.5 text-sm font-semibold text-command transition-colors hover:border-brass-bright hover:bg-brass-bright disabled:opacity-50"
    >
      {pending ? "Salvando…" : "Salvar termos"}
    </button>
  );
}

// Os termos ficam apenas no estado local do TagsInput enquanto o usuário
// digita (Enter separa cada um) — nada é persistido até "Salvar termos".
// No sucesso: toast global + volta para a tela anterior.
export function KeywordTermsForm({
  keywordId,
  initialTerms,
}: {
  keywordId: string;
  initialTerms: string[];
}) {
  const router = useRouter();
  const toast = useToast();

  async function handleAction(formData: FormData) {
    const result = await updateKeywordTerms(keywordId, {}, formData);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    toast("Termos salvos com sucesso");
    router.back();
  }

  return (
    <form action={handleAction} className="flex flex-col gap-3 border border-khaki/10 bg-panel p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="termos-relacionados" className="text-xs font-medium text-sage">
          Termos relacionados — digite um termo e pressione Enter para separar
        </label>
        <TagsInput
          name="termosRelacionados"
          initialTags={initialTerms}
          inputId="termos-relacionados"
          placeholder="ex: drone, míssil, OTAN…"
        />
      </div>
      <p className="text-xs text-sage/80">
        De 3 a 10 termos funciona bem — poucos ajudam menos a busca, muitos viram ruído.
        Nada é salvo até você clicar em &ldquo;Salvar termos&rdquo;.
      </p>

      <SubmitButton />
    </form>
  );
}
