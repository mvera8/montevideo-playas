"use client";

import { MapPin } from "@phosphor-icons/react/dist/ssr";
// Botón que pide la ubicación ("Sumar mi viaje", "Usar mi ubicación"). Mientras el navegador busca,
// muestra un punto que late (`Ocupado`) y el botón late suave para que se note que está haciendo algo; al tocarlo se achica un
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
      className={`flex flex-1 touch-manipulation select-none items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-transform duration-700 ease-fluido active:scale-[0.97] disabled:animate-pulse motion-reduce:transition-none motion-reduce:disabled:animate-none ${
        principal
          ? "bg-sky-700 text-white hover:bg-sky-800"
          : "ring-1 ring-slate-200 hover:bg-slate-50 disabled:bg-sky-50 disabled:text-sky-800 disabled:ring-sky-300 dark:ring-neutral-700 dark:hover:bg-oscuro-3 dark:disabled:bg-oscuro-2 dark:disabled:text-sky-200"
      }`}
    >
      {ubicando ? (
        <>
          <Ocupado />
          Ubicando…
        </>
      ) : (
        <>
          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
          {texto}
        </>
      )}
    </button>
  );
}

/** "Trabajando" dentro de un botón o una línea de texto: un punto que late (sin spinners circulares,
 *  skill landing-page-design B9). Anima solo transform y opacity. `className`: el tamaño del lugar. */
export function Ocupado({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span className={`relative grid shrink-0 place-items-center ${className}`} aria-hidden>
      <span className="absolute h-2 w-2 animate-ping rounded-full bg-current opacity-60 motion-reduce:animate-none" />
      <span className="h-2 w-2 rounded-full bg-current" />
    </span>
  );
}
