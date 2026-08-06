import Link from "next/link";
import { AgentSettingsForm } from "@/components/features/settings/agent-settings-form";
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
            className="flex h-9 w-9 items-center justify-center rounded-sm text-sage transition-colors hover:bg-khaki/10 hover:text-khaki"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div className="flex flex-col gap-0.5">
            <h1 className="font-display text-4xl font-semibold text-khaki">Configurações</h1>
            <p className="text-sm text-sage">
              Gerencie os assuntos monitorados e os parâmetros de exibição do painel.
            </p>
          </div>
        </header>

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-semibold text-khaki">Assuntos</h2>
            <span className="rounded-sm border border-khaki/15 bg-khaki/5 px-2 py-0.5 text-xs tabular-nums text-sage">
              {keywords.length}
            </span>
          </div>

          {keywords.length === 0 ? (
            <p className="text-sm text-sage">Nenhum assunto cadastrado ainda.</p>
          ) : (
            <KeywordTable keywords={keywords} />
          )}

          <KeywordCreateForm />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold text-khaki">Agentes de coleta</h2>
          <AgentSettingsForm />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold text-khaki">
            Configurações gerais
          </h2>
          <div className="max-w-md">
            <AppSettingsForm limiteNoticiasExibidas={settings.limiteNoticiasExibidas} />
          </div>
        </section>
      </main>
    </div>
  );
}
