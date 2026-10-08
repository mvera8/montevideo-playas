import type { Weather } from "./weather";

// Estado del cielo e íconos (trazos SVG en una grilla de 24×24, para dibujar con stroke) compartidos por
// el widget del clima (ClimaAhora) y el sello de la foto (sello-foto.ts, que los dibuja con Path2D).

export type EstadoCielo = "sol" | "luna" | "algoNublado" | "nublado" | "lluvia" | "tormenta";

export function estadoCielo(c: Pick<Weather, "weatherCode" | "isDay">): EstadoCielo {
  const w = c.weatherCode;
  if (w >= 95) return "tormenta";
  if ((w >= 51 && w <= 67) || (w >= 80 && w <= 82)) return "lluvia";
  if (w === 3 || w === 45 || w === 48) return "nublado";
  if (w === 2) return c.isDay ? "algoNublado" : "luna";
  return c.isDay ? "sol" : "luna";
}

// Trazos de Tabler (sun, moon, cloud, cloud-rain, cloud-storm, wind; @tabler/icons, MIT) para que
// combinen con el resto de los íconos del sitio. Tabler no tiene "parcialmente nublado": ese es propio.
export const ICONO_CIELO: Record<EstadoCielo, string[]> = {
  sol: [
    "M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0",
    "M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7",
  ],
  luna: ["M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008"],
  algoNublado: [
    "M8 4v1.5M3.8 5.8l1 1M2 10h1.5M12.2 5.8l-1 1",
    "M5.5 10a3 3 0 0 1 5.6-1.4",
    "M8 19h9a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.6A3.2 3.2 0 0 0 8 19Z",
  ],
  nublado: [
    "M6.657 18c-2.572 0 -4.657 -2.007 -4.657 -4.483c0 -2.475 2.085 -4.482 4.657 -4.482c.393 -1.762 1.794 -3.2 3.675 -3.773c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 1.927 -1.551 3.487 -3.465 3.487h-11.878",
  ],
  lluvia: ["M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7", "M11 13v2m0 3v2m4 -5v2m0 3v2"],
  tormenta: ["M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1", "M13 14l-2 4l3 0l-2 4"],
};

// Viento (Tabler "wind").
export const ICONO_VIENTO = [
  "M5 8h8.5a2.5 2.5 0 1 0 -2.34 -3.24",
  "M3 12h15.5a2.5 2.5 0 1 1 -2.34 3.24",
  "M4 16h5.5a2.5 2.5 0 1 1 -2.34 3.24",
];
