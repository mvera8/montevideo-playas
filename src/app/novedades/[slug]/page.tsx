import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BotonMapa from "@/components/BotonMapa";
import PaginaSitio from "@/components/PaginaSitio";
import { fechaNovedad, getNovedad, getNovedades } from "@/lib/novedades";

// Una nota de /novedades. Las publicadas se generan al compilar; una con fecha futura da 404 hasta
// ese día y después se genera sola (ISR, cada hora).
export const revalidate = 3600;

export function generateStaticParams() {
  return getNovedades().map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: PageProps<"/novedades/[slug]">): Promise<Metadata> {
  const novedad = getNovedad((await params).slug);
  if (!novedad) return {};
  return {
    title: novedad.titulo,
    description: novedad.resumen,
    alternates: { canonical: `/novedades/${novedad.slug}` },
  };
}

export default async function NovedadPage({ params }: PageProps<"/novedades/[slug]">) {
  const novedad = getNovedad((await params).slug);
  if (!novedad) notFound();

  return (
    <PaginaSitio
      titulo={novedad.titulo}
      bajada={novedad.resumen}
      antetitulo={
        <>
          {novedad.etiqueta} · <time dateTime={novedad.fecha}>{fechaNovedad(novedad.fecha)}</time>
        </>
      }
    >
      <article className="mt-8 space-y-4 text-base text-pretty text-slate-700">
        {novedad.cuerpo.map((b, i) =>
          b.tipo === "subtitulo" ? (
            <h2 key={i} className="pt-4 text-xl font-semibold text-slate-900">
              {b.texto}
            </h2>
          ) : b.tipo === "lista" ? (
            <ul key={i} className="space-y-2">
              {b.items.map((item) => (
                <li key={item} className="ml-6 list-disc pl-1">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p key={i}>{b.texto}</p>
          ),
        )}
      </article>

      <div className="mt-12 flex flex-col items-start gap-4 rounded-3xl bg-slate-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="text-lg font-semibold">Mirá todas las playas en el mapa</p>
          <p className="text-sm text-white/70">Es gratis y no necesitás registrarte.</p>
        </div>
        <BotonMapa tono="claro" texto="Abrir el mapa" />
      </div>

      <p className="mt-8 text-sm">
        <Link href="/novedades" className="text-sky-700 hover:underline">
          ← Todas las novedades
        </Link>
      </p>
    </PaginaSitio>
  );
}
