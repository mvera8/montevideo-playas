// Compartido entre servidor y navegador (sin dependencias).
/** Temporada de los me gusta ("2026-27"): cierra el 30 de abril, con la temporada de guardavidas
 *  (15/11 al 30/04, ver `getTemporada` en playas.ts). Lo que se vota desde el 1 de mayo suma a la
 *  siguiente. Misma regla que `public.temporada_actual()` en la base. */
export function temporadaMeGusta(now = new Date()) {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "numeric" })
    .formatToParts(now)
    .filter((p) => p.type !== "literal")
    .map((p) => Number(p.value));
  const inicio = m >= 5 ? y : y - 1;
  return `${inicio}-${String((inicio + 1) % 100).padStart(2, "0")}`;
}

export type TotalesMeGusta = { temporada: number; siempre: number };

/** Filas de `me_gusta_totales` (una por playa y temporada) → totales por playa: esta temporada y siempre. */
export function sumarTotales(filas: { playa: string; temporada: string; total: number }[], actual = temporadaMeGusta()) {
  const totales = new Map<string, TotalesMeGusta>();
  for (const f of filas) {
    const t = totales.get(f.playa) ?? { temporada: 0, siempre: 0 };
    t.siempre += f.total;
    if (f.temporada === actual) t.temporada += f.total;
    totales.set(f.playa, t);
  }
  return totales;
}
