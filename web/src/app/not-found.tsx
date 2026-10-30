import Link from "next/link";
import { SearchIcon } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <SearchIcon className="h-6 w-6 text-sage" />
        <p className="font-display text-xl font-semibold text-khaki">
          Página não encontrada.
        </p>
        <p className="text-sm text-sage">O endereço acessado não existe.</p>
        <Link
          href="/"
          className="mt-2 border border-brass bg-brass px-4 py-1.5 text-sm font-semibold text-command transition-colors hover:border-brass-bright hover:bg-brass-bright"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
