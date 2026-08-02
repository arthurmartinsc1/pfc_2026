import { KeywordRow, KEYWORD_TABLE_COLUMNS, type KeywordRowData } from "@/components/keyword-row";

export function KeywordTable({ keywords }: { keywords: KeywordRowData[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="min-w-[680px] divide-y divide-slate-100">
        <div
          className="grid items-center gap-4 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
          style={{ gridTemplateColumns: KEYWORD_TABLE_COLUMNS }}
        >
          <span>Palavra-chave</span>
          <span>Intervalo (min)</span>
          <span className="text-center">Ativa</span>
          <span>Status</span>
          <span className="text-right">Ações</span>
        </div>

        <div className="divide-y divide-slate-100">
          {keywords.map((keyword) => (
            <KeywordRow key={keyword.id} keyword={keyword} />
          ))}
        </div>
      </div>
    </div>
  );
}
