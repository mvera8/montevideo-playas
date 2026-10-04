import Link from "next/link";
import { SITIO } from "@/lib/sitio";

// Logo + nombre del sitio, enlazado a la home. Lo usan el encabezado y el pie de las páginas.
export default function MarcaSitio({ claro = false }: { claro?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label={`${SITIO.nombre}, inicio`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="12" cy="10" r="3.2" />
          <path d="M3.5 16c1.4 0 1.4-1 2.8-1s1.4 1 2.8 1 1.4-1 2.9-1 1.4 1 2.8 1 1.4-1 2.8-1 1.4 1 2.9 1" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className={`block text-[15px] font-semibold tracking-tight ${claro ? "text-white" : "text-slate-900 dark:text-white"}`}>
          {SITIO.nombre}
        </span>
        <span className={`block text-xs ${claro ? "text-white/70" : "text-slate-500 dark:text-slate-400"}`}>{SITIO.alcance}</span>
      </span>
    </Link>
  );
}
