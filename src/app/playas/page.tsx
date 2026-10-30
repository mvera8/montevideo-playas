import type { Metadata } from "next";
import { SITIO } from "@/lib/sitio";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Mapa de playas",
  description: `Mapa de las playas de ${SITIO.nombre}: bandera de guardavidas, calidad del agua, clima, pronóstico y cómo llegar en ómnibus.`,
  alternates: { canonical: "/playas" },
};

export default function PlayasPage() {
  return <h1 className="sr-only">{SITIO.marca}: playas, guardavidas y calidad del agua</h1>;
}
