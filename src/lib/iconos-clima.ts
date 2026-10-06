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

export const ICONO_CIELO: Record<EstadoCielo, string[]> = {
  sol: [
    "M16 12a4 4 0 1 1-8 0a4 4 0 1 1 8 0Z",
    "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  ],
  luna: ["M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"],
  algoNublado: [
    "M8 4v1.5M3.8 5.8l1 1M2 10h1.5M12.2 5.8l-1 1",
    "M5.5 10a3 3 0 0 1 5.6-1.4",
    "M8 19h9a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.6A3.2 3.2 0 0 0 8 19Z",
  ],
  nublado: ["M7 18h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 18Z"],
  lluvia: ["M7 14h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 14Z", "M8 17l-1 3M12 17l-1 3M16 17l-1 3"],
  tormenta: ["M7 13h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 13Z", "M12.5 13 10 17.5h3.5L11 22"],
};

// Gota (temperatura del agua) y viento.
export const ICONO_GOTA = ["M12 3.5s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11Z"];
export const ICONO_VIENTO = ["M3 8h10a3 3 0 1 0-3-3", "M3 12h15a3 3 0 1 1-3 3", "M3 16h7"];
