import { Waves } from "@phosphor-icons/react/dist/ssr";
import type { Playa } from "@/lib/playas";
import type { OlaMapa } from "./capa-casillas";
import { BotonModoMapa, LeyendaNiveles, type Nivel } from "./ModoMapa";
import { vientoVigente } from "./Viento";

// Modo "Olas" del mapa: frente a cada playa, crestas 3D que avanzan hacia la costa, con color, alto y ritmo
// según la altura de ola (las dibuja `CapaCasillas`, todas en un draw call, animadas en el vertex shader).
// Encima, una etiqueta en metros. Usa la ola que ya trae cada playa (WaveWatch III, ver `src/lib/mar.ts`): no
// hace pedidos nuevos. Es la ola de afuera de un modelo de 0,5°, orientativa, y playas vecinas suelen dar lo
// mismo. El modelo solo da la altura: que avance hacia la costa es un dibujo, no la dirección real.

// Solo describen el tamaño: que una ola sea chica no quiere decir que bañarse sea seguro.
export const NIVELES_OLAS: Nivel[] = [
  { hasta: 0.5, color: "#7dd3fc", label: "Muy chicas" },
  { hasta: 1, color: "#38bdf8", label: "Chicas" },
  { hasta: 1.5, color: "#2563eb", label: "Medianas" },
  { hasta: 2.5, color: "#7c3aed", label: "Grandes" },
  { hasta: Infinity, color: "#c026d3", label: "Muy grandes" },
];

const metros = (m: number) => m.toFixed(1).replace(".", ",");

export const textoOla = (m: number) => `${metros(m)} m`;

/** Ola de cada playa para la capa 3D: solo playas con dato y clima vigente. */
export function olasMapa(playas: Playa[], ahora = Date.now()): OlaMapa[] {
  return playas.flatMap((p) =>
    p.clima?.waveHeight != null && vientoVigente(p.clima.time, ahora)
      ? [
          {
            lng: p.lon,
            lat: p.lat,
            orientacion: p.orientacion,
            metros: p.clima.waveHeight,
            color: NIVELES_OLAS.find((n) => p.clima!.waveHeight! < n.hasta)!.color,
          },
        ]
      : [],
  );
}

export function BotonOlas({ activo, onCambiar }: { activo: boolean; onCambiar: (v: boolean) => void }) {
  return (
    <BotonModoMapa
      activo={activo}
      onCambiar={onCambiar}
      etiqueta="Olas"
      icono={<Waves className="h-5 w-5" weight={activo ? "bold" : "regular"} aria-hidden />}
    />
  );
}

export function LeyendaOlas({ time, vigente }: { time: string | null; vigente: boolean }) {
  return (
    <LeyendaNiveles
      titulo={vigente && time ? `Olas a las ${time.slice(11, 16)} · metros` : null}
      niveles={NIVELES_OLAS}
      corte={metros}
      nota="Modelo global, orientativo. El movimiento es un dibujo, no la dirección real."
      sinDatos="Sin datos recientes de olas"
    />
  );
}
