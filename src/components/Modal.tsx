"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  icono?: ReactNode;
  children: ReactNode;
  /** Botones al pie (p. ej. <BotonModal>). Si no hay, se muestra solo "Entendido". */
  acciones?: ReactNode;
};

// Modal reutilizable sobre <dialog> nativo: el navegador se encarga del foco, de Esc y de dejarlo
// por encima de todo (top layer). Tocar el fondo también lo cierra. Entra animando solo
// opacity/transform (keyframes `aparecer` de globals.css).
export default function Modal({ abierto, onCerrar, titulo, icono, children, acciones }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      onClick={(e) => e.target === e.currentTarget && onCerrar()}
      aria-labelledby="modal-titulo"
      className="m-auto w-[calc(100%-2rem)] max-w-sm animate-[aparecer_180ms_ease-out] rounded-3xl bg-white p-0 text-slate-900 shadow-2xl ring-1 ring-black/5 backdrop:bg-slate-950/50 backdrop:backdrop-blur-[2px] motion-reduce:animate-none dark:bg-oscuro-1 dark:text-white dark:ring-white/10"
    >
      <div className="p-6">
        {icono && (
          <div className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-sky-50 text-sky-700 dark:bg-oscuro-2 dark:text-sky-300">
            {icono}
          </div>
        )}
        <h2 id="modal-titulo" className="text-lg font-semibold tracking-tight">
          {titulo}
        </h2>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600 dark:text-neutral-300">{children}</div>
        <div className="mt-6 flex flex-col gap-2">{acciones ?? <BotonModal onClick={onCerrar}>Entendido</BotonModal>}</div>
      </div>
    </dialog>
  );
}

export function BotonModal({
  onClick,
  children,
  principal = false,
}: {
  onClick: () => void;
  children: ReactNode;
  principal?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full select-none rounded-xl px-3 py-2 text-base font-medium transition-transform duration-700 ease-fluido active:scale-[0.98] motion-reduce:transition-none ${
        principal
          ? "bg-sky-700 text-white hover:bg-sky-800"
          : "ring-1 ring-slate-200 hover:bg-slate-50 dark:ring-neutral-700 dark:hover:bg-oscuro-3"
      }`}
    >
      {children}
    </button>
  );
}
