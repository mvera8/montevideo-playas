"use client";

import "./globals.css";
import { SITIO } from "@/lib/sitio";

// Solo aparece si falla el layout raíz: reemplaza todo el documento, así que lleva su propio <html> y
// <body> y no usa componentes del sitio (podrían ser lo que falló). Sin metadata: el título va con <title>.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es-UY">
      <body className="grid min-h-dvh place-items-center bg-slate-50 px-4 font-sans text-slate-900 antialiased">
        <title>{`Algo salió mal · ${SITIO.marca}`}</title>
        <main className="max-w-md text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-sky-700">{SITIO.marca}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Algo salió mal</h1>
          <p className="mt-3 text-lg text-slate-600">No pudimos cargar el sitio. Probá de nuevo en unos segundos.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => retry()}
              className="rounded-full bg-slate-900 px-5 py-2.5 font-semibold text-white hover:bg-slate-800"
            >
              Probar de nuevo
            </button>
            {/* <a> y no <Link>: el router puede ser justamente lo que falló. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="font-medium text-sky-700 underline-offset-4 hover:underline">
              Ir al inicio
            </a>
          </div>
          {error.digest && <p className="mt-8 text-xs text-slate-400">Código del error: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
