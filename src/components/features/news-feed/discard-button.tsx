"use client";

import { useFormStatus } from "react-dom";

export function DiscardButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-md border border-ink/15 px-3 py-1 text-xs font-medium text-steel transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-50"
    >
      {pending ? "Descartando…" : "Descartar"}
    </button>
  );
}
