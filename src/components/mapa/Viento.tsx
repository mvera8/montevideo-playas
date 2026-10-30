import { Wind } from "@phosphor-icons/react/dist/ssr";
import type { Playa } from "@/lib/playas";
import type { VientoMapa } from "./capa-casillas";
import { BotonModoMapa, LeyendaNiveles, type Nivel } from "./ModoMapa";

// Modo "Viento" del mapa: por cada playa, flechas 3D que flotan sobre el agua y avanzan hacia donde
// sopla, con color, tamaño y velocidad de la animación según la intensidad (las dibuja `CapaCasillas`,
// todas en un draw call, animadas en el vertex shader). Encima, una etiqueta de km/h (capa de símbolos
// de MapLibre). Usa el mismo clima que ya trae cada playa (MET Norway, ver `src/lib/weather.ts`): no
// hace pedidos nuevos. Es el viento a 10 m del paso horario actual del modelo, no una medición.

/** Si el paso horario del pronóstico tiene más de esto, no se muestran flechas (dato vencido). */
export const HORAS_VIGENCIA_VIENTO = 3;

// Escala en km/h (aprox. Beaufort): calma, suave, moderado, fresco, fuerte.
export const NIVELES_VIENTO: Nivel[] = [
  { hasta: 12, color: "#38bdf8", label: "Calma" },
  { hasta: 20, color: "#22c55e", label: "Suave" },
  { hasta: 29, color: "#eab308", label: "Moderado" },
  { hasta: 39, color: "#f97316", label: "Fresco" },
  { hasta: Infinity, color: "#ef4444", label: "Fuerte" },
];

const nivel = (kmh: number) => NIVELES_VIENTO.findIndex((n) => kmh < n.hasta);

/** `time` es hora local de Montevideo ("YYYY-MM-DDTHH:mm"; UTC−3 fijo, sin horario de verano). */
export function vientoVigente(time: string | undefined, ahora = Date.now()) {
  if (!time) return false;
  return ahora - Date.parse(`${time}:00-03:00`) < HORAS_VIGENCIA_VIENTO * 3_600_000;
}

/** Viento de cada playa para la capa 3D: solo playas con clima vigente. */
export function vientosMapa(playas: Playa[], ahora = Date.now()): VientoMapa[] {
  return playas
    .filter((p) => p.clima && vientoVigente(p.clima.time, ahora))
    .map((p) => ({
      lng: p.lon,
      lat: p.lat,
      orientacion: p.orientacion,
      desde: p.clima!.windDirection,
      kmh: p.clima!.windSpeed,
      color: NIVELES_VIENTO[nivel(p.clima!.windSpeed)].color,
    }));
}

export function BotonViento({ activo, onCambiar }: { activo: boolean; onCambiar: (v: boolean) => void }) {
  return (
    <BotonModoMapa
      activo={activo}
      onCambiar={onCambiar}
      etiqueta="Viento"
      icono={<Wind className="h-5 w-5" weight={activo ? "bold" : "regular"} aria-hidden />}
    />
  );
}

/** Referencia de colores y hora del pronóstico; avisa si no hay datos recientes. */
export function LeyendaViento({ time, vigente }: { time: string | null; vigente: boolean }) {
  return (
    <LeyendaNiveles
      titulo={vigente && time ? `Viento a las ${time.slice(11, 16)} · km/h` : null}
      niveles={NIVELES_VIENTO}
      nota="Pronóstico de MET Norway, no es una medición."
      sinDatos="Sin datos recientes de viento"
    />
  );
}
