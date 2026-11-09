import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card max-w-md p-8 text-center">
        <p className="text-4xl font-semibold text-slate-300">404</p>
        <h1 className="mt-2 text-lg font-semibold">Page introuvable</h1>
        <Link href="/" className="btn-primary mt-5">Retour à l&apos;accueil</Link>
      </div>
    </main>
  );
}
