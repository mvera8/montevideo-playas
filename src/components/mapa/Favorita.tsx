"use client";

import { Star } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import Modal, { BotonModal } from "@/components/Modal";
import { useFavorita } from "@/lib/favorita-cliente";
import type { Playa } from "@/lib/playas";

// Amarilla si es favorita, gris si no (mismo criterio en la tarjeta y en el detalle).
const color = (llena: boolean) => (llena ? "text-amber-400" : "text-slate-400 dark:text-neutral-500");

function Estrella({ llena, className = "h-4 w-4" }: { llena: boolean; className?: string }) {
  return <Star weight={llena ? "fill" : "regular"} className={className} aria-hidden />;
}

/** Botón ⭐ de cada casilla en el detalle: la elige como favorita (reemplaza la anterior) o la saca. */
export function BotonFavorita({ playa, casilla, nombre }: { playa: string; casilla: string; nombre: string }) {
  const { favorita, pendiente, disponible, error, alternar } = useFavorita();
  if (!disponible) return null;
  const llena = favorita?.casilla === casilla;
  return (
    <button
      onClick={() => alternar({ playa, casilla })}
      disabled={pendiente}
      aria-pressed={llena}
      aria-label={llena ? `Sacar ${nombre} como favorita` : `Elegir ${nombre} como casilla favorita`}
      title={error ?? (llena ? "Casilla favorita" : "Elegir como favorita")}
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
  const { favorita } = useFavorita();
  if (favorita?.playa !== slug) return null;
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

/** Solo en /playas. Aviso de bandera verde en la favorita (una vez por día). */
export function ModalFavorita({
  playas,
  temporadaActiva,
  onVer,
}: {
  playas: Playa[];
  temporadaActiva: boolean;
  onVer: (p: Playa, casilla: string) => void;
}) {
  const { favorita, cargada } = useFavorita();
  const [cerrado, setCerrado] = useState(avisoCerrado);

  // Bandera verde vigente, solo confirmada por la base (no la copia local).
  const playa = cargada && temporadaActiva ? playas.find((p) => p.slug === favorita?.playa) : undefined;
  const casilla = playa?.guardavidas.find((g) => g.id === favorita?.casilla);
  if (!playa || casilla?.bandera !== "green") return null;

  function cerrar() {
    setCerrado(true);
    try {
      localStorage.setItem(CLAVE_CERRADO, hoy());
    } catch {}
  }

  const nombre = playa.nombre === casilla.nombre ? casilla.nombre : `${casilla.nombre} (${playa.nombre})`;

  return (
    <Modal
      abierto={!cerrado}
      onCerrar={cerrar}
      titulo={`Bandera verde en ${casilla.nombre}`}
      icono={<Estrella llena className="h-5 w-5 text-amber-400" />}
      acciones={
        <>
          <BotonModal
            principal
            onClick={() => {
              cerrar();
              onVer(playa, casilla.id);
            }}
          >
            Ver la casilla
          </BotonModal>
          <BotonModal onClick={cerrar}>Cerrar</BotonModal>
        </>
      }
    >
      <p>
        Tu casilla favorita {nombre} tiene bandera verde: apto para bañarse según la última bandera publicada por la
        Intendencia.
      </p>
      <p>Puede cambiar en cualquier momento: en la playa, seguí siempre a los guardavidas.</p>
    </Modal>
  );
}
