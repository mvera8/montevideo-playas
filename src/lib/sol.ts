// Amanecer y atardecer (cálculo local, ±1 min). Compartido entre servidor y navegador (sin dependencias):
// el servidor lo usa para el clima y el pronóstico, y el navegador para decidir si es de día con su
// propia hora (el HTML puede venir de una regeneración ISR de horas atrás, p. ej. de anoche).
// Ecuación del amanecer (https://en.wikipedia.org/wiki/Sunrise_equation), con refracción.

export type Punto = { lat: number; lon: number };

export const MONTEVIDEO: Punto = { lat: -34.9011, lon: -56.1645 };

const RAD = Math.PI / 180;
const DIA_MS = 86_400_000;

/** [amanecer, atardecer] en ms UTC para el día local `fecha` ("YYYY-MM-DD"). */
export function sol(fecha: string, { lat, lon }: Punto): [number, number] {
  const jdMediodia = Date.parse(`${fecha}T12:00:00Z`) / DIA_MS + 2440587.5;
  const n = Math.round(jdMediodia - 2451545 + 0.0008);
  const j = n - lon / 360;
  const m = (357.5291 + 0.98560028 * j) % 360;
  const c = 1.9148 * Math.sin(m * RAD) + 0.02 * Math.sin(2 * m * RAD) + 0.0003 * Math.sin(3 * m * RAD);
  const l = (m + c + 180 + 102.9372) % 360;
  const transito = 2451545 + j + 0.0053 * Math.sin(m * RAD) - 0.0069 * Math.sin(2 * l * RAD);
  const dec = Math.asin(Math.sin(l * RAD) * Math.sin(23.4397 * RAD));
  const w = Math.acos(
    (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * Math.sin(dec)) / (Math.cos(lat * RAD) * Math.cos(dec)),
  );
  const ms = (jd: number) => (jd - 2440587.5) * DIA_MS;
  return [ms(transito - w / (2 * Math.PI)), ms(transito + w / (2 * Math.PI))];
}

const fmtFecha = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Montevideo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Si en `ahora` es de día, y cuándo cambia (próximo amanecer o atardecer, en ms UTC). */
export function luzAhora(ahora = Date.now(), punto = MONTEVIDEO) {
  const [sale, pone] = sol(fmtFecha.format(ahora), punto);
  if (ahora < sale) return { esDeDia: false, cambia: sale };
  if (ahora < pone) return { esDeDia: true, cambia: pone };
  return { esDeDia: false, cambia: sol(fmtFecha.format(ahora + DIA_MS), punto)[0] };
}
