"use client";

import { useEffect } from "react";
import Link from "next/link";
import PaginaSitio from "@/components/PaginaSitio";
import BotonMapa from "@/components/BotonMapa";
import { reportarErrorCliente } from "@/lib/errores";

// Si algo falla al armar una página (servidor o cliente), se ve esto en vez de la pantalla genérica
// de Next, con el encabezado y el pie del sitio. `retry` vuelve a pedir y renderizar el segmento.
// Los errores del navegador se registran en Supabase (src/lib/errores.ts); los del servidor ya los
// registró `onRequestError`.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    reportarErrorCliente(error, "error.tsx");
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
          className="rounded-full bg-slate-900 px-3 py-2 text-base font-semibold text-white shadow-lg shadow-black/10 transition duration-700 ease-fluido hover:bg-slate-800 active:scale-[0.98]"
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
