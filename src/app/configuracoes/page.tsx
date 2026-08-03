import Link from "next/link";
import { AppSettingsForm } from "@/components/features/settings/app-settings-form";
import { KeywordCreateForm } from "@/components/features/keywords/keyword-create-form";
import { KeywordTable } from "@/components/features/keywords/keyword-table";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { getAppSettings, getKeywordsWithStatus } from "@/lib/db/queries";

// O status/última execução por keyword é escrito pelo agente de forma
// assíncrona (fora de qualquer ação da interface), então essa página não
// pode depender só de revalidatePath — precisa ler o estado atual a cada
// requisição.
export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const [keywords, settings] = await Promise.all([getKeywordsWithStatus(), getAppSettings()]);

  return (
    <div className="flex flex-1 justify-center px-4 py-8">
      <main className="flex w-full max-w-7xl flex-col gap-8">
        <header className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Voltar para notícias"
            title="Voltar"
            className="flex h-9 w-9 items-center justify-center rounded-full text-steel transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div className="flex flex-col gap-0.5">
            <h1 className="font-heading text-3xl font-semibold text-ink">Configurações</h1>
            <p className="text-sm text-steel">
              Gerencie as palavras-chave monitoradas e os parâmetros de exibição do painel.
            </p>
          </div>
        </header>

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-ink">Palavras-chave</h2>
            <span className="rounded-full bg-ink/8 px-2 py-0.5 text-xs font-medium text-steel">
              {keywords.length}
            </span>
          </div>

          {keywords.length === 0 ? (
            <p className="text-sm text-steel">Nenhuma palavra-chave cadastrada ainda.</p>
          ) : (
            <KeywordTable keywords={keywords} />
          )}

          <KeywordCreateForm />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-ink">Configurações gerais</h2>
          <div className="max-w-md">
            <AppSettingsForm limiteNoticiasExibidas={settings.limiteNoticiasExibidas} />
          </div>
        </section>
      </main>
    </div>
  );
}
