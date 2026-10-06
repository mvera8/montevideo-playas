import Image from "next/image";
import Link from "next/link";
import { SITIO } from "@/lib/sitio";

// Logo (public/logo.svg) + nombre del sitio, enlazado a la home. Lo usan el encabezado y el pie de las páginas.
export default function MarcaSitio({ claro = false }: { claro?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label={`${SITIO.nombre}, inicio`}>
      <Image src="/logo.svg" alt="" width={50} height={40} className="h-10 w-auto shrink-0 drop-shadow-sm" />
      <span className="leading-tight">
        <span className={`block text-[15px] font-semibold tracking-tight ${claro ? "text-white" : "text-slate-900"}`}>
          {SITIO.nombre}
        </span>
        <span className={`block text-xs ${claro ? "text-white/70" : "text-slate-500"}`}>{SITIO.alcance}</span>
      </span>
    </Link>
  );
}
