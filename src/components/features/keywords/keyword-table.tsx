import {
  KeywordRow,
  KEYWORD_TABLE_COLUMNS,
  type KeywordRowData,
} from "@/components/features/keywords/keyword-row";

export function KeywordTable({ keywords }: { keywords: KeywordRowData[] }) {
  return (
    <div className="overflow-x-auto border border-khaki/10 bg-panel">
      <div className="min-w-[900px] divide-y divide-khaki/8">
        <div
          className="grid items-center gap-4 bg-khaki/[0.04] px-4 py-2 text-xs font-medium text-sage"
          style={{ gridTemplateColumns: KEYWORD_TABLE_COLUMNS }}
        >
          <span>Assunto</span>
          <span>Termos relacionados</span>
          <span>Intervalo (min)</span>
          <span className="text-center">Ativa</span>
          <span>Status</span>
          <span className="text-right">Ações</span>
        </div>

        <div className="divide-y divide-khaki/8">
          {keywords.map((keyword) => (
            <KeywordRow key={keyword.id} keyword={keyword} />
          ))}
        </div>
      </div>
    </div>
  );
}
