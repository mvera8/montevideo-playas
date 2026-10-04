// Compartido entre servidor y navegador (sin dependencias).
/** Temporada de los me gusta: de julio a junio, con el verano en el medio ("2026-27").
 *  Misma regla que `public.temporada_actual()` en la base. */
export function temporadaMeGusta(now = new Date()) {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "numeric" })
    .formatToParts(now)
    .filter((p) => p.type !== "literal")
    .map((p) => Number(p.value));
  const inicio = m >= 7 ? y : y - 1;
  return `${inicio}-${String((inicio + 1) % 100).padStart(2, "0")}`;
}
