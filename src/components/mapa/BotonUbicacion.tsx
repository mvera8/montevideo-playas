"use client";

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
          ? "bg-sky-600 text-white hover:bg-sky-700"
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
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          {texto}
        </>
      )}
    </button>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 animate-spin motion-reduce:animate-none ${className}`} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
