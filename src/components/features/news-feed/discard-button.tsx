"use client";

import { useFormStatus } from "react-dom";

export function DiscardButton() {
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
