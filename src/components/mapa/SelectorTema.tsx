"use client";

import { useEffect, useRef, useState } from "react";
import { TEMAS, type Tema } from "./temas";

type Props = {
  tema: Tema;
  auto: boolean;
  temaAuto: Tema;
  onElegir: (t: Tema | null) => void; // null = automático según el clima
};

const opcion = (activa: boolean) =>
  `flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm ${
    activa ? "bg-sky-50 font-medium text-sky-900 dark:bg-oscuro-3 dark:text-white" : "hover:bg-slate-50 dark:hover:bg-oscuro-3"
  }`;

/** Lista de estilos (automático + manuales). La usan el desplegable de escritorio y, en móvil, el menú del sitio. */
export function OpcionesTema({ tema, auto, temaAuto, onElegir }: Props) {
  return (
    <>
      <button role="menuitemradio" aria-checked={auto} onClick={() => onElegir(null)} className={opcion(auto)}>
        <span className="text-lg leading-none" aria-hidden>
          ✨
        </span>
        <span>
          <span className="block">Automático</span>
          <span className="block text-xs font-normal text-slate-500">
            Según el clima: {TEMAS[temaAuto].icono} {TEMAS[temaAuto].label.toLowerCase()}
          </span>
        </span>
      </button>
      <div className="my-1 h-px bg-slate-100 dark:bg-oscuro-3" />
      {(Object.keys(TEMAS) as Tema[]).map((t) => (
        <button key={t} role="menuitemradio" aria-checked={!auto && tema === t} onClick={() => onElegir(t)} className={opcion(!auto && tema === t)}>
          <span className="text-lg leading-none" aria-hidden>
            {TEMAS[t].icono}
          </span>
          {TEMAS[t].label}
        </button>
      ))}
    </>
  );
}

// Desplegable de estilo del mapa (solo escritorio; en móvil va dentro del menú del sitio).
export default function SelectorTema({ tema, auto, temaAuto, onElegir }: Props) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al tocar afuera o con Escape.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setAbierto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  const elegir = (t: Tema | null) => {
    onElegir(t);
    setAbierto(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        aria-label={`Estilo del mapa: ${TEMAS[tema].label}${auto ? " (automático)" : ""}`}
        className="flex h-12 items-center gap-2 rounded-2xl bg-white/95 px-3.5 text-sm font-medium text-slate-700 shadow-lg ring-1 ring-black/5 backdrop-blur hover:text-slate-900 dark:bg-oscuro-1/95 dark:text-neutral-200 dark:ring-white/10"
      >
        <span className="text-lg leading-none" aria-hidden>
          {TEMAS[tema].icono}
        </span>
        <span>{TEMAS[tema].label}</span>
        {auto && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-oscuro-3 dark:text-neutral-300">Auto</span>}
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-60 origin-top-right animate-[aparecer_150ms_ease-out] rounded-2xl bg-white/95 p-1.5 shadow-xl ring-1 ring-black/5 backdrop-blur motion-reduce:animate-none dark:bg-oscuro-1/95 dark:ring-white/10"
        >
          <OpcionesTema tema={tema} auto={auto} temaAuto={temaAuto} onElegir={elegir} />
        </div>
      )}
    </div>
  );
}
