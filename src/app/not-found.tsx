import Link from "next/link";
import { SearchIcon } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <SearchIcon className="h-6 w-6 text-steel" />
        <p className="font-heading text-lg font-semibold text-ink">Página não encontrada.</p>
        <p className="text-sm text-steel">O endereço acessado não existe.</p>
        <Link
          href="/"
          className="mt-2 rounded-md bg-navy px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-navy-deep"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
