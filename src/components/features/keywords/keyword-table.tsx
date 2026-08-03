import {
  KeywordRow,
  KEYWORD_TABLE_COLUMNS,
  type KeywordRowData,
} from "@/components/features/keywords/keyword-row";

export function KeywordTable({ keywords }: { keywords: KeywordRowData[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-ink/10 bg-surface">
      <div className="min-w-[680px] divide-y divide-ink/8">
        <div
          className="grid items-center gap-4 bg-ink/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-steel"
          style={{ gridTemplateColumns: KEYWORD_TABLE_COLUMNS }}
        >
          <span>Palavra-chave</span>
          <span>Intervalo (min)</span>
          <span className="text-center">Ativa</span>
          <span>Status</span>
          <span className="text-right">Ações</span>
        </div>

        <div className="divide-y divide-ink/8">
          {keywords.map((keyword) => (
            <KeywordRow key={keyword.id} keyword={keyword} />
          ))}
        </div>
      </div>
    </div>
  );
}
