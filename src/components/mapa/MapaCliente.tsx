"use client";

import dynamic from "next/dynamic";

// Mientras baja el chunk del mapa: la misma forma que la pantalla (buscador y menú arriba, panel a la
// izquierda en escritorio, hoja abajo en el celular), latiendo. Medidas tomadas de Mapa.tsx.
function EsqueletoMapa() {
  const bloque = "animate-pulse rounded-2xl bg-white/80 motion-reduce:animate-none dark:bg-oscuro-1";
  return (
    <div role="status" className="relative h-dvh overflow-hidden bg-sky-50 dark:bg-oscuro-0">
      <span className="sr-only">Cargando mapa…</span>
      {/* Celular */}
      <div className={`absolute left-3 right-16 top-3 h-12 md:hidden ${bloque}`} />
      <div className={`absolute right-3 top-3 h-12 w-12 md:hidden ${bloque}`} />
      <div className={`absolute inset-x-0 bottom-0 h-[45vh] rounded-b-none rounded-t-3xl md:hidden ${bloque}`} />
      {/* Escritorio */}
      <div className="absolute inset-y-0 left-0 hidden w-[380px] flex-col gap-3 p-4 max-md:hidden md:flex">
        <div className={`h-12 ${bloque}`} />
        <div className={`h-24 ${bloque}`} />
        <div className={`h-32 ${bloque}`} />
        <div className={`flex-1 ${bloque}`} />
      </div>
    </div>
  );
}

// MapLibre y Three.js solo corren en el navegador: se cargan en un chunk aparte.
const MapaCliente = dynamic(() => import("./Mapa"), {
  ssr: false,
  loading: () => <EsqueletoMapa />,
});

export default MapaCliente;
