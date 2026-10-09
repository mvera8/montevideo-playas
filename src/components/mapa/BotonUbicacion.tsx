"use client";

import { IconLoader2, IconMapPin } from "@tabler/icons-react";
// Botón que pide la ubicación ("Sumar mi viaje", "Usar mi ubicación"). Mientras el navegador busca,
// muestra un spinner y late suave para que se note que está haciendo algo; al tocarlo se achica un
// poco. `select-none` evita que en iPhone un toque largo seleccione el texto en vez de apretar.
export default function BotonUbicacion({
  texto,
  ubicando,
  onClick,
  principal = false,
}: {
  texto: string;
  ubicando: boolean;
  onClick: () => void;
  principal?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={ubicando}
      aria-busy={ubicando}
      className={`flex flex-1 touch-manipulation select-none items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-transform active:scale-[0.97] disabled:animate-pulse motion-reduce:transition-none motion-reduce:disabled:animate-none ${
        principal
          ? "bg-sky-700 text-white hover:bg-sky-800"
          : "ring-1 ring-slate-200 hover:bg-slate-50 disabled:bg-sky-50 disabled:text-sky-800 disabled:ring-sky-300 dark:ring-slate-700 dark:hover:bg-slate-800 dark:disabled:bg-sky-950 dark:disabled:text-sky-200"
      }`}
    >
      {ubicando ? (
        <>
          <Spinner />
          Ubicando…
        </>
      ) : (
        <>
          <IconMapPin className="h-4 w-4 shrink-0" aria-hidden />
          {texto}
        </>
      )}
    </button>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <IconLoader2 className={`shrink-0 animate-spin motion-reduce:animate-none ${className}`} aria-hidden />
  );
}
