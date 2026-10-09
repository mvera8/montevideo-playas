"use client";

import type { ReactNode } from "react";

// Botón "i" que muestra u oculta una tarjeta de ayuda. Van separados porque el botón suele ir
// junto a un título y la tarjeta debajo; el estado lo maneja quien los usa.
export function BotonInfo({ abierto, onClick, etiqueta }: { abierto: boolean; onClick: () => void; etiqueta: string }) {
  return (
    <button
      onClick={onClick}
      aria-expanded={abierto}
      aria-label={etiqueta}
      // El ::after invisible agranda el área de toque a 40 px sin cambiar el tamaño del círculo.
      className={`relative grid h-4 w-4 shrink-0 after:absolute after:-inset-3 after:content-[''] place-items-center rounded-full text-[10px] font-bold leading-none ring-[1.5px] ${
        abierto
          ? "bg-sky-700 text-white ring-sky-700"
          : "text-slate-500 ring-slate-400 hover:bg-slate-100 dark:ring-slate-500 dark:hover:bg-slate-800"
      }`}
    >
      i
    </button>
  );
}

export function TarjetaInfo({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {children}
    </div>
  );
}
