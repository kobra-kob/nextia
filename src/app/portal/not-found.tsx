import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <p className="text-4xl font-semibold text-slate-300">404</p>
      <h1 className="mt-2 text-lg font-semibold">Page introuvable</h1>
      <p className="mt-1 text-sm text-slate-500">Cet élément n&apos;existe pas ou vous n&apos;y avez pas accès.</p>
      <Link href="/portal" className="btn-primary mt-5">Retour à l&apos;accueil</Link>
    </div>
  );
}
