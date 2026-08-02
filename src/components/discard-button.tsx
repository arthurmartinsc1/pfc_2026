"use client";

import { useFormStatus } from "react-dom";

export function DiscardButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
    >
      {pending ? "Descartando…" : "Descartar"}
    </button>
  );
}
