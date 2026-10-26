"use client";

// Banderas y UV pedidos desde el navegador cuando el servidor no llega a la IM (README → "Banderas desde
// el navegador"). Desde 10/2026 la IM filtra las IP de fuera de Uruguay y Vercel no tiene región acá; los
// visitantes, en cambio, casi todos están en Uruguay, y el sitio móvil de la IM responde CORS a cualquier
// origen (ver banderas.ts).
//
// - Solo si hace falta: con `fuente === "im"` el servidor ya trajo todo y no se pide nada. El UV, solo si
//   el clima de la ciudad llegó sin el medido (`uvIm`).
// - Un pedido de ~3 KB (casillas) y otro de ~0,4 KB (clima), con tope de 8 s. Se repiten cuando cambian
//   los datos del servidor (al volver a la pestaña, `useRefrescarAlVolver` de Mapa.tsx refresca).
// - Se completan solo las casillas que ya vienen del servidor (snapshot src/data/casillas.json): una casilla
//   nueva de la IM aparece recién al actualizar el snapshot (`npm run casillas`).
// - Mismas reglas de vigencia que el servidor (`banderasDe`). Fuera de Uruguay la IM también bloquea al
//   navegador: queda el aviso "Sin datos de la Intendencia".

import { useEffect, useMemo, useState } from "react";
import { banderasDe, HORAS_VIGENCIA_UV, URL_CASILLAS_MOVIL, URL_CLIMA_MOVIL, type BanderasIm } from "./banderas";
import type { Playa, Temporada } from "./playas";
import type { Weather } from "./weather";

const TIMEOUT = 8000;

/** De dónde salieron las banderas: el servidor, el navegador, todavía cargando, o ninguno. */
export type FuenteBanderas = "im" | "navegador" | "cargando" | "respaldo";

type Casillas = { estado: "ok"; porId: Map<string, BanderasIm> } | { estado: "error"; error: string } | null;

export async function pedirCasillasIm(): Promise<Map<string, BanderasIm>> {
  const res = await fetch(URL_CASILLAS_MOVIL, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`La Intendencia respondió ${res.status}`);
  const { features } = (await res.json()) as { features: { properties: BanderasIm & { id: string } }[] };
  if (!Array.isArray(features) || !features.length) throw new Error("La Intendencia no devolvió casillas");
  return new Map(features.map((f) => [f.properties.id, f.properties]));
}

export async function pedirUvIm(): Promise<{ valor: number; fecha: string } | null> {
  const res = await fetch(URL_CLIMA_MOVIL, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`La Intendencia respondió ${res.status}`);
  const uv = ((await res.json()) as { ValorIndiceUV?: { value?: unknown; dateIssued?: unknown } }).ValorIndiceUV;
  if (typeof uv?.value !== "number" || typeof uv.dateIssued !== "string" || Number.isNaN(Date.parse(uv.dateIssued))) return null;
  return Date.now() - Date.parse(uv.dateIssued) <= HORAS_VIGENCIA_UV * 3_600_000 ? { valor: uv.value, fecha: uv.dateIssued } : null;
}

const mensaje = (e: unknown) =>
  e instanceof Error && e.name === "TimeoutError" ? "La Intendencia no respondió a tiempo" : e instanceof Error ? e.message : String(e);

export function useBanderasNavegador({
  playas,
  fuente,
  temporada,
  climaCiudad,
}: {
  playas: Playa[];
  fuente: "im" | "respaldo";
  temporada: Temporada;
  climaCiudad: Weather | null;
}) {
  const [casillas, setCasillas] = useState<Casillas>(null);
  const [uv, setUv] = useState<Weather["uvIm"]>(null);

  const faltanBanderas = fuente === "respaldo";
  useEffect(() => {
    if (!faltanBanderas) return;
    let vigente = true;
    pedirCasillasIm().then(
      (porId) => vigente && setCasillas({ estado: "ok", porId }),
      (e) => vigente && setCasillas({ estado: "error", error: mensaje(e) }),
    );
    return () => {
      vigente = false;
    };
  }, [faltanBanderas, playas]);

  const faltaUv = Boolean(climaCiudad && !climaCiudad.uvIm);
  useEffect(() => {
    if (!faltaUv) return;
    let vigente = true;
    pedirUvIm().then(
      (v) => vigente && setUv(v),
      () => {}, // sin UV medido queda el máximo estimado de MET, como en el servidor
    );
    return () => {
      vigente = false;
    };
  }, [faltaUv, climaCiudad]);

  const conBanderas = useMemo(() => {
    if (!faltanBanderas || casillas?.estado !== "ok") return playas;
    return playas.map((p) => ({
      ...p,
      guardavidas: p.guardavidas.map((g) => {
        const c = casillas.porId.get(g.id);
        return c ? { ...g, ...banderasDe(c, temporada.activa) } : g;
      }),
    }));
  }, [playas, faltanBanderas, casillas, temporada.activa]);

  const clima = useMemo(
    () => (climaCiudad && faltaUv && uv ? { ...climaCiudad, uvIm: uv } : climaCiudad),
    [climaCiudad, faltaUv, uv],
  );

  const fuenteBanderas: FuenteBanderas = !faltanBanderas
    ? "im"
    : casillas === null
      ? "cargando"
      : casillas.estado === "ok"
        ? "navegador"
        : "respaldo";

  return {
    playas: conBanderas,
    climaCiudad: clima,
    fuente: fuenteBanderas,
    errorNavegador: casillas?.estado === "error" ? casillas.error : null,
  };
}
