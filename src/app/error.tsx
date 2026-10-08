"use client";

import { useEffect } from "react";
import Link from "next/link";
import PaginaSitio from "@/components/PaginaSitio";
import BotonMapa from "@/components/BotonMapa";

// Si algo falla al armar una página (servidor o cliente), se ve esto en vez de la pantalla genérica
// de Next, con el encabezado y el pie del sitio. `retry` vuelve a pedir y renderizar el segmento.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PaginaSitio
      antetitulo="Error"
      titulo="Algo salió mal"
      bajada="No pudimos mostrar esta página. Puede ser un problema momentáneo con alguna de las fuentes de datos."
    >
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-full bg-slate-900 px-5 py-2.5 font-semibold text-white shadow-lg shadow-black/10 transition-colors hover:bg-slate-800"
        >
          Probar de nuevo
        </button>
        <BotonMapa tamano="chico" tono="claro" />
        <Link href="/" className="font-medium text-sky-700 underline-offset-4 hover:underline">
          Ir al inicio
        </Link>
      </div>
      {error.digest && <p className="mt-8 text-xs text-slate-400">Código del error: {error.digest}</p>}
    </PaginaSitio>
  );
}
