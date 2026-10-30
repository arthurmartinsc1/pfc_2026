import Link from "next/link";
import { notFound } from "next/navigation";
import { KeywordTermsForm } from "@/components/features/keywords/keyword-terms-form";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { getKeywordById } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function AssuntoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const keyword = await getKeywordById(id);
  if (!keyword) notFound();

  return (
    <div className="flex flex-1 justify-center px-4 py-8">
      <main className="flex w-full max-w-3xl flex-col gap-6">
        <header className="flex items-center gap-3">
          <Link
            href="/configuracoes"
            aria-label="Voltar para configurações"
            title="Voltar"
            className="flex h-9 w-9 items-center justify-center rounded-sm text-sage transition-colors hover:bg-khaki/10 hover:text-khaki"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-medium text-sage">Assunto</p>
            <h1 className="font-display text-3xl font-semibold text-khaki">{keyword.termo}</h1>
            <p className="text-sm text-sage">
              Termos relacionados ajudam os agentes a encontrar e ranquear notícias deste
              assunto com mais precisão.
            </p>
          </div>
        </header>

        <KeywordTermsForm keywordId={keyword.id} initialTerms={keyword.termosRelacionados} />
      </main>
    </div>
  );
}
