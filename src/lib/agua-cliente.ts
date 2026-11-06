"use client";

// Calidad del agua pedida desde el navegador cuando el servidor no llega a la IM (README → "Calidad del agua",
// "Si el servidor no llega a la IM"). Mismo esquema que las banderas (banderas-cliente.ts): desde 10/2026 la IM
// filtra las IP de fuera de Uruguay, los visitantes casi todos están acá, y ckan-data.montevideo.gub.uy
// responde `access-control-allow-origin: *` (verificado 06/11/2026).
//
// - Solo si hace falta: si alguna playa ya trae `agua` del servidor, no se pide nada.
// - Lo mismo que el servidor: muestras en streaming con corte a los 120 días (~48 KB de ~2,2 MB) y la media
//   geométrica (~20 KB), procesadas con `procesar` (mismo criterio y vigencia, calidad-agua-datos.ts).
// - Tope de 15 s. Si falla (p. ej. fuera de Uruguay), las playas quedan "sin datos" como hasta ahora.

import { useEffect, useMemo, useState } from "react";
import {
  DIAS_HISTORIAL,
  descargar,
  descargarReciente,
  hace,
  procesar,
  URL_MEDIAS,
  URL_MUESTRAS,
  type CalidadAgua,
} from "./calidad-agua-datos";
import type { Playa } from "./playas";

const TIMEOUT = 15_000;

export async function pedirCalidadAguaIm(): Promise<Map<string, CalidadAgua>> {
  const signal = AbortSignal.timeout(TIMEOUT);
  const [muestras, medias] = await Promise.all([
    descargarReciente(URL_MUESTRAS, hace(DIAS_HISTORIAL), { signal }),
    descargar(URL_MEDIAS, { signal }),
  ]);
  const datos = procesar(muestras, medias);
  if (!datos.size) throw new Error("La Intendencia no devolvió muestras");
  return datos;
}

export function useAguaNavegador(playas: Playa[]) {
  const [agua, setAgua] = useState<Map<string, CalidadAgua> | null>(null);

  const faltaAgua = playas.length > 0 && playas.every((p) => !p.agua);
  useEffect(() => {
    if (!faltaAgua) return;
    let vigente = true;
    pedirCalidadAguaIm().then(
      (d) => vigente && setAgua(d),
      () => {}, // sin datos queda "sin datos", igual que si el servidor no hubiera llegado
    );
    return () => {
      vigente = false;
    };
  }, [faltaAgua]);

  return useMemo(
    () => (faltaAgua && agua ? playas.map((p) => ({ ...p, agua: agua.get(p.slug) ?? null })) : playas),
    [playas, faltaAgua, agua],
  );
}
