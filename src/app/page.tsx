import Link from "next/link";
import { SITIO } from "@/lib/sitio";

// Home provisoria: el mapa vive en /playas. Pendiente de diseño.
export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-slate-50 px-4 text-center dark:bg-slate-950">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{SITIO.marca}</h1>
      <p className="max-w-md text-lg text-slate-600 dark:text-slate-400">
        Playas, guardavidas, calidad del agua y clima en {SITIO.alcance}.
      </p>
      <Link
        href="/playas"
        className="rounded-full bg-sky-600 px-6 py-3 font-medium text-white hover:bg-sky-700"
      >
        Ver el mapa de playas
      </Link>
      <nav className="flex gap-4 text-sm text-slate-500">
        <Link href="/terminos" className="hover:underline">Términos</Link>
        <Link href="/privacidad" className="hover:underline">Privacidad</Link>
      </nav>
    </main>
  );
}
