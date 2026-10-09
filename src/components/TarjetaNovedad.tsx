import Link from "next/link";
import { fechaNovedad, type Novedad } from "@/lib/novedades";

// Tarjeta de una nota de /novedades. La usan la home y el listado; todas iguales.
export default function TarjetaNovedad({ novedad }: { novedad: Novedad }) {
  return (
    <Link
      href={`/novedades/${novedad.slug}`}
      className="group flex h-full flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 transition-shadow duration-700 ease-fluido hover:shadow-md hover:ring-amber-300 sm:p-8"
    >
      <p className="flex items-center gap-2 text-xs">
        <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-900">
          {novedad.etiqueta}
        </span>
        <time dateTime={novedad.fecha} className="text-slate-500">
          {fechaNovedad(novedad.fecha)}
        </time>
      </p>
      <h3 className="mt-3 text-xl font-semibold tracking-tight text-balance text-slate-900 group-hover:text-sky-800 sm:mt-4 sm:text-2xl">
        {novedad.titulo}
      </h3>
      <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600 sm:line-clamp-none">{novedad.resumen}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-900">
        Leer nota
        <span aria-hidden className="transition-transform duration-700 ease-fluido group-hover:translate-x-0.5 motion-reduce:transition-none">
          →
        </span>
      </span>
    </Link>
  );
}
