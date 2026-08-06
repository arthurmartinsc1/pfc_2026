"use client";

import { useState } from "react";

// Input de chips/tags: digitar e pressionar Enter (ou vírgula) adiciona o
// termo; Backspace com o campo vazio remove o último; cada tag tem um
// botão de remover. Os valores vão no submit do formulário pai como um
// hidden por termo (mesmo `name`), lidos no servidor com formData.getAll.
export function TagsInput({
  name,
  initialTags,
  placeholder,
  inputId,
}: {
  name: string;
  initialTags?: string[];
  placeholder?: string;
  inputId?: string;
}) {
  const [tags, setTags] = useState<string[]>(initialTags ?? []);
  const [draft, setDraft] = useState("");

  function addDraft() {
    const value = draft.trim().replace(/,+$/, "").trim();
    if (value && !tags.includes(value)) {
      setTags([...tags, value]);
    }
    setDraft("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addDraft();
    } else if (event.key === "Backspace" && draft === "" && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  }

  return (
    <div className="flex min-h-[34px] w-full flex-wrap items-center gap-1.5 border border-khaki/15 bg-panel-raised px-2 py-1 transition-colors focus-within:border-brass/60">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-sm border border-brass/25 bg-brass/10 px-1.5 py-0.5 text-xs text-brass"
        >
          <input type="hidden" name={name} value={tag} />
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            aria-label={`Remover termo ${tag}`}
            className="text-brass/70 transition-colors hover:text-brass-bright"
          >
            ×
          </button>
        </span>
      ))}
      <input
        id={inputId}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addDraft}
        placeholder={tags.length === 0 ? placeholder : undefined}
        className="min-w-[120px] flex-1 bg-transparent py-0.5 text-sm text-khaki outline-none placeholder:text-sage/50"
      />
    </div>
  );
}
