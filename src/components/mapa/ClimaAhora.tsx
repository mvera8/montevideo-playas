"use client";

import type { Weather } from "@/lib/weather";

// Widget "Montevideo ahora": fondo e ilustración según el estado del tiempo.
// Decoraciones en SVG estático (sin animación) para no sumar trabajo de render.

type Estado = "sol" | "luna" | "algoNublado" | "nublado" | "lluvia" | "tormenta";

function estado(c: Weather): Estado {
  const w = c.weatherCode;
  if (w >= 95) return "tormenta";
  if ((w >= 51 && w <= 67) || (w >= 80 && w <= 82)) return "lluvia";
  if (w === 3 || w === 45 || w === 48) return "nublado";
  if (w === 2) return c.isDay ? "algoNublado" : "luna";
  return c.isDay ? "sol" : "luna";
}

const FONDO: Record<Estado, { dia: string; noche: string }> = {
  sol: { dia: "linear-gradient(135deg,#e2574a 0%,#ef7d45 100%)", noche: "linear-gradient(135deg,#1e3a8a,#172554)" },
  luna: { dia: "linear-gradient(135deg,#1e3a8a,#172554)", noche: "linear-gradient(135deg,#1e3a8a,#172554)" },
  algoNublado: { dia: "linear-gradient(135deg,#2f7be0,#2563c9)", noche: "linear-gradient(135deg,#1e3a8a,#1e2a5a)" },
  nublado: { dia: "linear-gradient(135deg,#4a6d9c,#365783)", noche: "linear-gradient(135deg,#2c3e5c,#1f2d44)" },
  lluvia: { dia: "linear-gradient(135deg,#5457c4,#4338b8)", noche: "linear-gradient(135deg,#34336e,#25244f)" },
  tormenta: { dia: "linear-gradient(135deg,#3b2f7a,#231c4d)", noche: "linear-gradient(135deg,#2a2356,#16123a)" },
};

const ICONO: Record<Estado, React.ReactNode> = {
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  luna: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  algoNublado: (
    <>
      <path d="M8 4v1.5M3.8 5.8l1 1M2 10h1.5M12.2 5.8l-1 1" />
      <path d="M5.5 10a3 3 0 0 1 5.6-1.4" />
      <path d="M8 19h9a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.6A3.2 3.2 0 0 0 8 19Z" />
    </>
  ),
  nublado: <path d="M7 18h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 18Z" />,
  lluvia: (
    <>
      <path d="M7 14h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 14Z" />
      <path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" />
    </>
  ),
  tormenta: (
    <>
      <path d="M7 13h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 13Z" />
      <path d="M12.5 13 10 17.5h3.5L11 22" />
    </>
  ),
};

/** Ilustración de fondo (esquina derecha). */
function Decoracion({ e }: { e: Estado }) {
  const gotas = (opacidad: number) => (
    <g stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity={opacidad}>
      {Array.from({ length: 16 }, (_, i) => {
        const x = 10 + ((i * 37) % 300);
        const y = (i * 23) % 70;
        return <line key={i} x1={x} y1={y} x2={x - 6} y2={y + 16} />;
      })}
    </g>
  );
  return (
    <svg viewBox="0 0 320 90" preserveAspectRatio="xMaxYMid slice" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      {e === "sol" && (
        <g>
          <circle cx="300" cy="-4" r="80" fill="#fff" opacity="0.08" />
          <circle cx="300" cy="-4" r="56" fill="#fff" opacity="0.1" />
          <circle cx="300" cy="-4" r="34" fill="#f9d56e" />
        </g>
      )}
      {e === "luna" && (
        <g>
          <circle cx="296" cy="2" r="70" fill="#fff" opacity="0.05" />
          <circle cx="296" cy="2" r="46" fill="#fff" opacity="0.06" />
          <circle cx="296" cy="2" r="26" fill="#f6e3a0" />
          {[[40, 14], [96, 30], [150, 10], [210, 40], [250, 16], [120, 62], [60, 70]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.4 : 1} fill="#fff" opacity="0.7" />
          ))}
        </g>
      )}
      {e === "algoNublado" && (
        <g>
          <circle cx="292" cy="6" r="28" fill="#f9d56e" />
          <path d="M150 34c20-16 46-14 62 2 18-12 46-10 60 8 16-6 38 0 48 14v-58H150Z" fill="#fff" opacity="0.18" />
        </g>
      )}
      {e === "nublado" && (
        <g fill="#fff">
          <path d="M120 0c18 18 50 22 76 8 24 14 58 12 80-4 16 12 34 14 44 10V0Z" opacity="0.14" />
          <path d="M170 0c14 26 46 32 70 18 20 16 52 16 80 0V0Z" opacity="0.12" />
        </g>
      )}
      {e === "lluvia" && gotas(0.32)}
      {e === "tormenta" && (
        <g>
          {gotas(0.3)}
          {/* Rayo hacia el centro, para no quedar detrás de la hora. */}
          <path d="M196 8 182 36h12l-10 26 26-36h-13l9-18Z" fill="#fde68a" opacity="0.5" />
        </g>
      )}
    </svg>
  );
}

const grados = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n)}°`);

export default function ClimaAhora({ clima, ciudad }: { clima: Weather; ciudad: string }) {
  // La ciudad va en la etiqueta accesible: visualmente ya la muestra la marca flotante.
  const e = estado(clima);

  return (
    <div
      role="group"
      aria-label={`Clima ahora en ${ciudad}`}
      className="relative overflow-hidden rounded-2xl p-4 text-white shadow-sm"
      style={{ background: clima.isDay ? FONDO[e].dia : FONDO[e].noche }}
    >
      <Decoracion e={e} />
      {/* Dos filas alineadas por línea base: estado | agua, y temperatura | viento. */}
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.18)]">
        <p className="flex min-w-0 items-center gap-1.5 self-center text-sm font-medium">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {ICONO[e]}
          </svg>
          <span className="truncate">{clima.description}</span>
        </p>
        <p className="self-center whitespace-nowrap text-right text-xs text-white/90">Agua {grados(clima.waterTemp)}</p>

        <p className="flex items-baseline gap-2">
          {/* Mismo tamaño que el contador de "Fuera de temporada". */}
          <span className="text-3xl font-semibold leading-none tabular-nums">{grados(clima.airTemp)}</span>
          <span className="whitespace-nowrap text-xs text-white/85 tabular-nums">
            {grados(clima.min)} / {grados(clima.max)}
          </span>
        </p>
        <p className="whitespace-nowrap text-right text-xs text-white/90">
          Viento {Math.round(clima.windSpeed)} km/h {clima.windDirectionLabel}
        </p>
      </div>
    </div>
  );
}
