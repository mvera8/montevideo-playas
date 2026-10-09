"use client";

import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { createContext, useContext, useId, useState, type ReactNode } from "react";

type Grupo = { abierta: string | null; setAbierta: (clave: string | null) => void };
const GrupoContexto = createContext<Grupo | null>(null);

// Agrupa secciones para que haya una sola abierta a la vez. Vuelve a `inicial` cuando cambia
// `reiniciarCon` (p. ej. al elegir otra playa) sin desmontar el contenido.
export function GrupoPlegable({
  inicial,
  reiniciarCon,
  children,
}: {
  inicial: string | null;
  reiniciarCon: string;
  children: ReactNode;
}) {
  const [abierta, setAbierta] = useState(inicial);
  const [previo, setPrevio] = useState(reiniciarCon);
  if (previo !== reiniciarCon) {
    setPrevio(reiniciarCon);
    setAbierta(inicial);
  }
  return <GrupoContexto.Provider value={{ abierta, setAbierta }}>{children}</GrupoContexto.Provider>;
}

// Sección del detalle de una playa que se pliega. El encabezado cerrado muestra un resumen para
// leer todo de un vistazo. El contenido queda montado al cerrar (conserva el estado y los fetch,
// p. ej. la ruta de Cómo llegar) y aparece con un fade: no se anima la altura.
export default function SeccionPlegable({
  titulo,
  clave = titulo,
  resumen,
  resumenSoloCerrada = false,
  ancla,
  children,
}: {
  titulo: string;
  clave?: string; // identifica la sección dentro de un GrupoPlegable
  resumen?: ReactNode;
  resumenSoloCerrada?: boolean; // ocultar el resumen al abrir si el contenido ya lo repite
  ancla?: string; // id de la sección, para llevarla a la vista (p. ej. al tocar el agua viva del mapa)
  children: ReactNode;
}) {
  const grupo = useContext(GrupoContexto);
  const [local, setLocal] = useState(false);
  const abierta = grupo ? grupo.abierta === clave : local;
  const alternar = () => (grupo ? grupo.setAbierta(abierta ? null : clave) : setLocal(!local));
  const id = useId();

  return (
    <section id={ancla} className="mt-3 scroll-mt-2 border-t border-slate-100 pt-1 dark:border-neutral-800">
      <h3>
        <button
          onClick={alternar}
          aria-expanded={abierta}
          aria-controls={id}
          className="flex w-full items-center gap-2 rounded-lg py-2 text-left"
        >
          <CaretRight className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-700 ease-fluido ${abierta ? "rotate-90" : ""}`} weight="bold" aria-hidden />
          <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-slate-500">{titulo}</span>
          {resumen && !(resumenSoloCerrada && abierta) && (
            <span className="ml-auto min-w-0 text-right text-xs leading-5 text-slate-600 dark:text-neutral-300">{resumen}</span>
          )}
        </button>
      </h3>
      <div id={id} hidden={!abierta} className="animate-[aparecer_150ms_ease-out] pb-2 pt-1">
        {children}
      </div>
    </section>
  );
}
