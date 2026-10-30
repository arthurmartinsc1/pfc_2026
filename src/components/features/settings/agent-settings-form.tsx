"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";

// Canais considerados pelos agentes de busca/resumo. Os agentes leem a
// configuração real do próprio ambiente em que rodam (envs BUSCADOR_*/
// RESUMIDOR_*); este formulário persiste a escolha apenas em localStorage —
// nada é escrito no banco (o contrato não prevê tabela para isso).
//
// A escolha de modelo de cada agente não aparece aqui de propósito: quem
// decide isso é o ambiente onde o agente roda, não a interface.

const STORAGE_KEY = "agent-settings";

const CHANNELS = [
  { id: "cnnbrasil", nome: "CNN Brasil" },
  { id: "g1", nome: "G1 (Globo)" },
  { id: "bbc", nome: "BBC News Brasil" },
  { id: "folha", nome: "Folha de S.Paulo" },
  { id: "estadao", nome: "Estadão" },
  { id: "uol", nome: "UOL Notícias" },
  { id: "agenciabrasil", nome: "Agência Brasil" },
  { id: "r7", nome: "R7" },
];

type AgentSettings = {
  canais: string[];
};

// Configuração ativa dos agentes hoje (defaults das envs).
const DEFAULTS: AgentSettings = {
  canais: ["cnnbrasil", "g1"],
};

// Lê só o que ainda existe no formulário — valores antigos gravados por
// versões anteriores (modelos dos agentes) são ignorados.
function parseStored(raw: string): AgentSettings {
  const parsed: unknown = JSON.parse(raw);
  const canais =
    parsed && typeof parsed === "object" && "canais" in parsed
      ? (parsed as { canais: unknown }).canais
      : null;
  if (!Array.isArray(canais)) return DEFAULTS;
  return { canais: canais.filter((id): id is string => typeof id === "string") };
}

export function AgentSettingsForm() {
  const toast = useToast();
  const [settings, setSettings] = useState<AgentSettings>(DEFAULTS);

  // localStorage só existe no cliente — carregar depois da hidratação,
  // de forma assíncrona (setState síncrono em effect dispara re-render
  // em cascata e é barrado pelo lint do React Compiler).
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) setSettings(parseStored(stored));
      } catch {
        // valor corrompido: segue com os defaults
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  function toggleChannel(id: string, checked: boolean) {
    setSettings((current) => ({
      ...current,
      canais: checked ? [...current.canais, id] : current.canais.filter((c) => c !== id),
    }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    toast("Parâmetros salvos com sucesso");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 border border-khaki/10 bg-panel p-4">
      <fieldset className="flex flex-col gap-3">
        <legend className="pb-2 text-sm font-semibold text-khaki">Canais de notícia</legend>
        <p className="text-xs text-sage">
          Fontes consideradas pelo buscador — candidatos de outras fontes são descartados.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CHANNELS.map((channel) => (
            <label
              key={channel.id}
              className="flex items-center gap-2 border border-khaki/10 bg-panel-raised px-3 py-2 text-sm text-khaki transition-colors hover:border-brass/40"
            >
              <input
                type="checkbox"
                checked={settings.canais.includes(channel.id)}
                onChange={(e) => toggleChannel(channel.id, e.target.checked)}
                className="h-4 w-4 border-khaki/20 accent-brass"
              />
              {channel.nome}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        className="self-start border border-brass bg-brass px-4 py-1.5 text-sm font-semibold text-command transition-colors hover:border-brass-bright hover:bg-brass-bright"
      >
        Salvar parâmetros
      </button>
    </form>
  );
}
