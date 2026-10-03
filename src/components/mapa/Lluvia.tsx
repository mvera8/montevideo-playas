import type { CSSProperties } from "react";
import type { IntensidadLluvia } from "./temas";

// Efecto de lluvia liviano: solo CSS. Cada capa es un mosaico SVG de gotas que se desplaza con
// `transform` (lo anima la GPU: sin repintado ni JavaScript por cuadro). Dos capas a distinta
// velocidad dan profundidad. No captura clics y se apaga con "reducir movimiento".

const TILE = 200; // px; el desplazamiento por ciclo es exactamente un mosaico → loop sin saltos

function mosaico(gotas: number, largo: [number, number], color: string, semilla: number) {
  // Generador determinístico: el mismo patrón en servidor y cliente.
  let x = semilla;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const lineas = Array.from({ length: gotas }, () => {
    const px = (rnd() * TILE).toFixed(1);
    const py = (rnd() * TILE).toFixed(1);
    const l = (largo[0] + rnd() * (largo[1] - largo[0])).toFixed(1);
    const o = (0.35 + rnd() * 0.65).toFixed(2);
    return `<line x1='${px}' y1='${py}' x2='${px}' y2='${(+py + +l).toFixed(1)}' stroke='${color}' stroke-opacity='${o}' stroke-width='1' stroke-linecap='round'/>`;
  }).join("");
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${TILE}' height='${TILE}'>${lineas}</svg>`)}")`;
}

const CONFIG: Record<IntensidadLluvia, { capas: { gotas: number; largo: [number, number]; seg: number }[]; opacidad: number }> = {
  llovizna: { capas: [{ gotas: 10, largo: [6, 10], seg: 1.4 }], opacidad: 0.55 },
  lluvia: {
    capas: [
      { gotas: 14, largo: [8, 14], seg: 1.1 },
      { gotas: 10, largo: [14, 22], seg: 0.6 },
    ],
    opacidad: 0.7,
  },
  tormenta: {
    capas: [
      { gotas: 18, largo: [10, 16], seg: 0.9 },
      { gotas: 14, largo: [18, 28], seg: 0.45 },
    ],
    opacidad: 0.8,
  },
};

export default function Lluvia({ intensidad, oscuro }: { intensidad: IntensidadLluvia; oscuro: boolean }) {
  const cfg = CONFIG[intensidad];
  const color = oscuro ? "#cfe0ff" : "#42566b";

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[5] overflow-hidden motion-reduce:hidden"
      style={{ opacity: cfg.opacidad }}
    >
      {/* Capa inclinada y agrandada para que la lluvia caiga en diagonal sin bordes vacíos. */}
      <div className="absolute -inset-[20%] rotate-[14deg]">
        {cfg.capas.map((c, i) => (
          <div
            key={i}
            className="absolute inset-x-0 animate-[caer_linear_infinite] will-change-transform"
            style={
              {
                top: -TILE,
                bottom: 0,
                backgroundImage: mosaico(c.gotas, c.largo, color, 17 + i * 31),
                backgroundSize: `${TILE}px ${TILE}px`,
                animationDuration: `${c.seg}s`,
                "--tile": `${TILE}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      {intensidad === "tormenta" && (
        <div className={`absolute inset-0 animate-[relampago_11s_linear_infinite] ${oscuro ? "bg-white" : "bg-sky-50"}`} />
      )}
    </div>
  );
}
