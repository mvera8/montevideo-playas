import Link from "next/link";
import { fechaNovedad, type Novedad } from "@/lib/novedades";

// Tarjeta de una nota de /novedades. La usan la home y el listado; todas iguales.
export default function TarjetaNovedad({ novedad }: { novedad: Novedad }) {
  return (
    <Link
      href={`/novedades/${novedad.slug}`}
      className="group flex h-full flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md hover:ring-amber-300 sm:p-8 dark:bg-slate-900 dark:ring-white/10 dark:hover:ring-amber-500/60"
    >
      <p className="flex items-center gap-2 text-xs">
        <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
          {novedad.etiqueta}
        </span>
        <time dateTime={novedad.fecha} className="text-slate-500">
          {fechaNovedad(novedad.fecha)}
        </time>
      </p>
      <h3 className="mt-4 text-2xl font-semibold tracking-tight text-balance text-slate-900 group-hover:text-sky-800 dark:text-white dark:group-hover:text-sky-300">
        {novedad.titulo}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{novedad.resumen}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-white">
        Leer nota
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none">
          →
        </span>
      </span>
    </Link>
  );
}
