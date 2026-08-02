import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-base font-semibold text-slate-900">Página não encontrada.</p>
        <p className="text-sm text-slate-500">O endereço acessado não existe.</p>
        <Link
          href="/"
          className="mt-2 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
