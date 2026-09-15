"use client";

import { useFormStatus } from "react-dom";
import { discardNewsItem } from "@/lib/db/actions";
import { useToast } from "@/components/ui/toast";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 border border-khaki/15 px-3 py-1 text-xs font-medium text-sage transition-colors hover:border-signal/50 hover:bg-signal/10 hover:text-signal disabled:opacity-50"
    >
      {pending ? "Descartando…" : "Descartar"}
    </button>
  );
}

// Client component com o próprio <form>: o card de notícia é server
// component e não pode chamar useToast — o feedback fica aqui.
export function DiscardButton({ newsItemId }: { newsItemId: string }) {
  const toast = useToast();

  async function handleAction() {
    await discardNewsItem(newsItemId);
    toast("Notícia descartada");
  }

  return (
    <form action={handleAction}>
      <SubmitButton />
    </form>
  );
}
