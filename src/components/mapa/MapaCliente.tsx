"use client";

import dynamic from "next/dynamic";

// MapLibre y Three.js solo corren en el navegador: se cargan en un chunk aparte.
const MapaCliente = dynamic(() => import("./Mapa"), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh items-center justify-center bg-sky-50 text-sky-800 dark:bg-oscuro-0 dark:text-sky-200">
      Cargando mapa…
    </div>
  ),
});

export default MapaCliente;
