"use client";

import { Check, ShareNetwork } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState } from "react";

/** Comparte el enlace de la playa, que sale con su tarjeta (/playas/[slug]/opengraph-image). */
export default function BotonCompartir({ slug, nombre }: { slug: string; nombre: string }) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(t);
  }, [copiado]);

  async function compartir() {
    const url = `${window.location.origin}/playas/${slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: nombre, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return; // cancelado por la persona
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      window.prompt("Copiá el enlace", url); // sin permiso para el portapapeles
    }
  }

  return (
    <button
      onClick={compartir}
      aria-label={`Compartir ${nombre}`}
      title={copiado ? "Enlace copiado" : "Compartir"}
      className="flex shrink-0 touch-manipulation select-none items-center rounded-full px-2 py-2 text-slate-600 ring-1 ring-slate-200 transition-transform duration-700 ease-fluido hover:bg-slate-50 active:scale-90 dark:text-neutral-300 dark:ring-neutral-700 dark:hover:bg-oscuro-3"
    >
      {copiado ? <Check className="h-4 w-4" aria-hidden /> : <ShareNetwork className="h-4 w-4" aria-hidden />}
      <span role="status" className="sr-only">
        {copiado ? "Enlace copiado" : ""}
      </span>
    </button>
  );
}
