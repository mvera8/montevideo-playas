"use client";

import { useEffect, useState } from "react";
import { pedirCasillasIm, pedirUvIm } from "@/lib/banderas-cliente";
import Fila, { type FilaEstado } from "./Fila";

// Lo que el mapa le pide a la IM desde el navegador cuando el servidor no llega (src/lib/banderas-cliente.ts).
// Se chequea al abrir la página, desde la conexión de quien la mira: fuera de Uruguay la IM también lo bloquea.

const BASE: FilaEstado[] = [
  {
    nombre: "Sitio de playas de la IM — banderas",
    usa: "Banderas de cada casilla cuando el servidor no llega a la Intendencia.",
    estado: "cargando",
    detalle: "Consultando…",
    ms: null,
  },
  {
    nombre: "Sitio de playas de la IM — índice UV",
    usa: "UV medido cuando el servidor no llega a la Intendencia.",
    estado: "cargando",
    detalle: "Consultando…",
    ms: null,
  },
];

const mensaje = (e: unknown) =>
  e instanceof Error && e.name === "TimeoutError" ? "No respondió a tiempo" : e instanceof Error ? e.message : String(e);

async function medir(i: number, probar: () => Promise<string>): Promise<[number, Partial<FilaEstado>]> {
  const t0 = performance.now();
  try {
    const detalle = await probar();
    return [i, { estado: "ok", detalle, ms: Math.round(performance.now() - t0) }];
  } catch (e) {
    return [i, { estado: "caido", detalle: mensaje(e), ms: Math.round(performance.now() - t0) }];
  }
}

export default function DesdeNavegador() {
  const [filas, setFilas] = useState(BASE);

  useEffect(() => {
    let vigente = true;
    const actualizar = ([i, cambio]: [number, Partial<FilaEstado>]) =>
      vigente && setFilas((f) => f.map((x, j) => (j === i ? { ...x, ...cambio } : x)));
    medir(0, async () => {
      const casillas = await pedirCasillasIm();
      const conBandera = [...casillas.values()].filter((c) => c.safetyFlag && c.safetyFlag !== "noData").length;
      return `${casillas.size} casillas (${conBandera} con bandera de seguridad informada)`;
    }).then(actualizar);
    medir(1, async () => {
      const uv = await pedirUvIm();
      return uv ? `UV ${uv.valor}` : "Responde, sin UV de la última hora";
    }).then(actualizar);
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">Desde tu navegador</h2>
      <p className="mt-1 text-sm text-slate-600">
        Si nuestro servidor no llega a la Intendencia, el mapa le pide las banderas y el UV directamente desde tu
        conexión. Esto se verifica ahora, desde tu navegador.
      </p>
      <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {filas.map((c) => (
          <Fila key={c.nombre} c={c} />
        ))}
      </ul>
    </section>
  );
}
