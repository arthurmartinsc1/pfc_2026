"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";

// Parâmetros dos agentes de busca/resumo. Os agentes leem a configuração
// real do próprio ambiente em que rodam (envs BUSCADOR_*/RESUMIDOR_*);
// este formulário persiste as escolhas apenas em localStorage — nada é
// escrito no banco (o contrato não prevê tabela para isso).

const STORAGE_KEY = "agent-settings";

const MODEL_OPTIONS = [
  "Qwen/Qwen2.5-1.5B-Instruct",
  "Qwen/Qwen2.5-3B-Instruct",
  "Qwen/Qwen2.5-7B-Instruct",
  "meta-llama/Llama-3.2-3B-Instruct",
  "google/gemma-2-2b-it",
];

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
  buscadorModel: string;
  resumidorModel: string;
  canais: string[];
};

// Configuração ativa dos agentes hoje (defaults das envs).
const DEFAULTS: AgentSettings = {
  buscadorModel: "Qwen/Qwen2.5-1.5B-Instruct",
  resumidorModel: "Qwen/Qwen2.5-3B-Instruct",
  canais: ["cnnbrasil", "g1"],
};

const inputClass =
  "border border-khaki/15 bg-panel-raised px-3 py-1.5 text-sm text-khaki transition-colors focus:border-brass/60";
const labelClass = "text-xs font-medium text-sage";

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
        if (stored) setSettings({ ...DEFAULTS, ...JSON.parse(stored) });
      } catch {
        // valor corrompido: segue com os defaults
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  function update<K extends keyof AgentSettings>(key: K, value: AgentSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

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
        <legend className="pb-2 text-sm font-semibold text-khaki">Agente buscador</legend>
        <div className="flex min-w-[260px] max-w-md flex-col gap-1">
          <label htmlFor="buscador-model" className={labelClass}>
            Modelo de seleção
          </label>
          <select
            id="buscador-model"
            value={settings.buscadorModel}
            onChange={(e) => update("buscadorModel", e.target.value)}
            className={inputClass}
          >
            {MODEL_OPTIONS.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="pb-2 text-sm font-semibold text-khaki">Agente resumidor</legend>
        <div className="flex min-w-[260px] max-w-md flex-col gap-1">
          <label htmlFor="resumidor-model" className={labelClass}>
            Modelo de resumo
          </label>
          <select
            id="resumidor-model"
            value={settings.resumidorModel}
            onChange={(e) => update("resumidorModel", e.target.value)}
            className={inputClass}
          >
            {MODEL_OPTIONS.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

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
