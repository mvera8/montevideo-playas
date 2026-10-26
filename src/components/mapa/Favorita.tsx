"use client";

import { Star } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import Modal, { BotonModal } from "@/components/Modal";
import { TOPE_FAVORITAS, useFavoritas } from "@/lib/favorita-cliente";
import type { Guardavidas, Playa } from "@/lib/playas";

// Amarilla si es favorita, gris si no (mismo criterio en la tarjeta y en el detalle).
const color = (llena: boolean) => (llena ? "text-amber-400" : "text-slate-400 dark:text-neutral-500");

function Estrella({ llena, className = "h-4 w-4" }: { llena: boolean; className?: string }) {
  return <Star weight={llena ? "fill" : "regular"} className={className} aria-hidden />;
}

/** Botón ⭐ de cada casilla en el detalle: la agrega a las favoritas (hasta 3) o la saca. */
export function BotonFavorita({ playa, casilla, nombre }: { playa: string; casilla: string; nombre: string }) {
  const { favoritas, pendiente, disponible, error, alternar } = useFavoritas();
  if (!disponible) return null;
  const llena = favoritas.some((f) => f.casilla === casilla);
  return (
    <button
      onClick={() => alternar({ playa, casilla })}
      disabled={pendiente}
      aria-pressed={llena}
      aria-label={llena ? `Sacar ${nombre} de favoritas` : `Agregar ${nombre} a casillas favoritas`}
      title={error ?? (llena ? "Casilla favorita" : "Agregar a favoritas")}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-transform duration-700 ease-fluido active:scale-90 disabled:opacity-60 ${
        llena ? "" : "hover:bg-slate-100 dark:hover:bg-oscuro-4"
      } ${color(llena)}`}
    >
      <Estrella llena={llena} className="h-5 w-5" />
    </button>
  );
}

/** Estrellita amarilla en la tarjeta o píldora de una playa con casilla favorita (nada en las demás). */
export function MarcaFavorita({ slug, className = "h-3 w-3" }: { slug: string; className?: string }) {
  const { favoritas } = useFavoritas();
  if (!favoritas.some((f) => f.playa === slug)) return null;
  return (
    <span className={`inline-flex ${color(true)}`} title="Acá tenés una casilla favorita">
      <Estrella llena className={className} />
      <span className="sr-only">Acá tenés una casilla favorita</span>
    </span>
  );
}

// Guarda el día (en Montevideo) en que se cerró el aviso verde: no vuelve hasta el día siguiente.
const CLAVE_CERRADO = "aviso-favorita-cerrado";
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo" }).format(new Date());

function avisoCerrado() {
  try {
    return localStorage.getItem(CLAVE_CERRADO) === hoy();
  } catch {
    return true; // sin almacenamiento no podríamos recordar que lo cerró: mejor no mostrarlo
  }
}

/** Solo en /playas. Un mismo <Modal> con dos contenidos: el tope de favoritas (al querer agregar una
 *  cuarta) y el aviso de bandera verde en las favoritas (una vez por día). El tope tiene prioridad. */
export function ModalFavoritas({
  playas,
  temporadaActiva,
  onVer,
}: {
  playas: Playa[];
  temporadaActiva: boolean;
  onVer: (p: Playa, casilla: string) => void;
}) {
  const { favoritas, cargada, tope, cerrarTope } = useFavoritas();
  const [verdeCerrado, setVerdeCerrado] = useState(avisoCerrado);

  // Favoritas con bandera verde vigente, solo confirmadas por la base (no la copia local).
  const verdes: { playa: Playa; casilla: Guardavidas }[] = [];
  if (cargada && temporadaActiva) {
    for (const f of favoritas) {
      const playa = playas.find((p) => p.slug === f.playa);
      const casilla = playa?.guardavidas.find((g) => g.id === f.casilla);
      if (playa && casilla?.bandera === "green") verdes.push({ playa, casilla });
    }
  }
  const verde = !verdeCerrado && verdes.length > 0;

  function cerrarVerde() {
    setVerdeCerrado(true);
    try {
      localStorage.setItem(CLAVE_CERRADO, hoy());
    } catch {}
  }

  const nombre = (v: (typeof verdes)[number]) =>
    v.playa.nombre === v.casilla.nombre ? v.casilla.nombre : `${v.casilla.nombre} (${v.playa.nombre})`;

  const contenido = tope
    ? {
        onCerrar: cerrarTope,
        titulo: `Ya tenés ${TOPE_FAVORITAS} casillas favoritas`,
        acciones: undefined, // "Entendido"
        cuerpo: (
          <p>
            Podés tener hasta {TOPE_FAVORITAS}. Para agregar esta, sacá una de las que ya marcaste tocando su estrella en la
            lista de casillas.
          </p>
        ),
      }
    : {
        onCerrar: cerrarVerde,
        titulo:
          verdes.length === 1
            ? `Bandera verde en ${verdes[0].casilla.nombre}`
            : `Bandera verde en ${verdes.length} de tus favoritas`,
        acciones: (
          <>
            {verdes.map((v, i) => (
              <BotonModal
                key={v.casilla.id}
                principal={i === 0}
                onClick={() => {
                  cerrarVerde();
                  onVer(v.playa, v.casilla.id);
                }}
              >
                {verdes.length === 1 ? "Ver la casilla" : `Ver ${v.casilla.nombre}`}
              </BotonModal>
            ))}
            <BotonModal onClick={cerrarVerde}>Cerrar</BotonModal>
          </>
        ),
        cuerpo: (
          <>
            {verdes.length === 1 ? (
              <p>
                Tu casilla favorita {nombre(verdes[0])} tiene bandera verde: apto para bañarse según la última bandera
                publicada por la Intendencia.
              </p>
            ) : (
              <>
                <p>Según la última bandera publicada por la Intendencia, es apto para bañarse en:</p>
                <ul className="list-disc pl-5">
                  {verdes.map((v) => (
                    <li key={v.casilla.id}>{nombre(v)}</li>
                  ))}
                </ul>
              </>
            )}
            <p>Puede cambiar en cualquier momento: en la playa, seguí siempre a los guardavidas.</p>
          </>
        ),
      };

  return (
    <Modal
      abierto={tope || verde}
      onCerrar={contenido.onCerrar}
      titulo={contenido.titulo}
      icono={<Estrella llena className="h-5 w-5 text-amber-400" />}
      acciones={contenido.acciones}
    >
      {contenido.cuerpo}
    </Modal>
  );
}
