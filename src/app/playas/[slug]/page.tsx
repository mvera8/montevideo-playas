import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlayas, getSlugsPlayas } from "@/lib/playas";
import { SITIO } from "@/lib/sitio";

// Dirección propia de cada playa, para compartirla con su tarjeta (opengraph-image.tsx). El mapa está en
// el layout y toma la playa de la URL. Sin datos del momento en la descripción: quedaría vieja en buscadores.
export const revalidate = 300;
export const dynamicParams = false; // una dirección inventada da 404 sin pedir datos

export function generateStaticParams() {
  return getSlugsPlayas().map((slug) => ({ slug }));
}

async function getPlaya(slug: string) {
  return (await getPlayas()).playas.find((p) => p.slug === slug);
}

export async function generateMetadata({ params }: PageProps<"/playas/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const playa = await getPlaya(slug);
  if (!playa) return {};
  return {
    title: playa.nombre,
    description: `${playa.nombre}, ${SITIO.nombre}: bandera de guardavidas, calidad del agua, clima, pronóstico y cómo llegar en ómnibus.`,
    alternates: { canonical: `/playas/${slug}` },
  };
}

export default async function PlayaPage({ params }: PageProps<"/playas/[slug]">) {
  const playa = await getPlaya((await params).slug);
  if (!playa) notFound();
  return <h1 className="sr-only">{playa.nombre}: bandera, calidad del agua y clima</h1>;
}
