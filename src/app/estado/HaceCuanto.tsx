"use client";

import { useSyncExternalStore } from "react";

// "hace N min" calculado en el navegador: con ISR el HTML puede ser de hace horas (lo regenera la
// primera visita después de un rato sin visitas), así que la antigüedad no puede venir del servidor.
const cadaMinuto = (cb: () => void) => {
  const id = setInterval(cb, 30_000);
  return () => clearInterval(id);
};

export default function HaceCuanto({ hora }: { hora: number }) {
  const min = useSyncExternalStore(
    cadaMinuto,
    () => Math.max(0, Math.floor((Date.now() - hora) / 60_000)),
    () => null,
  );
  if (min == null) return null;
  return <> ({min < 1 ? "recién" : min < 60 ? `hace ${min} min` : `hace ${Math.floor(min / 60)} h`})</>;
}
