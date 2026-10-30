"use client";

// Casilla favorita desde el navegador (README → "Casilla favorita"). Una por persona (la PK de la base):
// elegir otra reemplaza la anterior. Misma cuenta anónima de los me gusta (supabase-navegador.ts). Tabla
// `casilla_favorita` con RLS (cada uno ve y cambia solo la suya) y función
// `alternar_favorita(p_playa, p_casilla)`: elige, reemplaza o saca, en un viaje. Se guarda la casilla
// (id de la IM) y su playa: la playa ordena el listado, la casilla lleva la estrella 3D, el centrado
// inicial del mapa y el aviso de bandera verde.
//
// Performance: la favorita se copia en localStorage (`favorita`, JSON) para ordenar el listado y centrar
// el mapa al instante sin bajar supabase-js. La base manda: si el navegador tiene sesión, al cargar se
// lee (una fila, por RLS solo la propia) y se corrige la copia. Sin sesión no hay favorita y no se pide nada.

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { haySesion, sesion, supabaseDisponible } from "./supabase-navegador";

export const favoritaDisponible = supabaseDisponible;

export type Favorita = { playa: string; casilla: string };

const CLAVE_LOCAL = "favorita";

function leerCopia(): Favorita | null {
  try {
    localStorage.removeItem("favoritas"); // copia de cuando había hasta 3
    const f = JSON.parse(localStorage.getItem(CLAVE_LOCAL) ?? "null");
    return typeof f?.playa === "string" && typeof f?.casilla === "string" ? { playa: f.playa, casilla: f.casilla } : null;
  } catch {
    return null;
  }
}

function guardarCopia(f: Favorita | null) {
  try {
    if (f) localStorage.setItem(CLAVE_LOCAL, JSON.stringify(f));
    else localStorage.removeItem(CLAVE_LOCAL);
  } catch {}
}

type Estado = {
  favorita: Favorita | null;
  cargada: boolean;
  pendiente: boolean;
  error: string | null;
};

let estado: Estado = { favorita: null, cargada: false, pendiente: false, error: null };
let iniciado = false;
let elegidaEnEstaCarga = false; // si la eligió mientras cargaba, manda la elección
const oyentes = new Set<() => void>();

function cambiar(parcial: Partial<Estado>) {
  estado = { ...estado, ...parcial };
  oyentes.forEach((o) => o());
}

function suscribir(o: () => void) {
  oyentes.add(o);
  return () => oyentes.delete(o);
}

// Una vez por carga: la copia local al instante y después la de la base (si hay sesión).
function cargar() {
  if (iniciado || !favoritaDisponible) return;
  iniciado = true;
  if (!haySesion()) {
    guardarCopia(null);
    cambiar({ favorita: null, cargada: true });
    return;
  }
  cambiar({ favorita: leerCopia() });
  sesion(false)
    .then(async (c) => {
      if (!c) return null;
      const { data, error } = await c
        .from("casilla_favorita")
        .select("playa,casilla")
        .order("actualizado", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data[0] as Favorita | undefined) ?? null;
    })
    .then((f) => {
      if (elegidaEnEstaCarga) return;
      guardarCopia(f);
      cambiar({ favorita: f });
    })
    .catch(() => {}) // sin conexión: queda la copia local
    .finally(() => cambiar({ cargada: true }));
}

/** Casilla favorita del navegador y la acción de elegirla o sacarla, con actualización optimista. */
export function useFavorita() {
  const e = useSyncExternalStore(suscribir, () => estado, () => estado);
  useEffect(cargar, []);

  const alternar = useCallback(async (f: Favorita) => {
    if (estado.pendiente) return;
    const antes = estado.favorita;
    elegidaEnEstaCarga = true;
    cambiar({ favorita: antes?.casilla === f.casilla ? null : f, pendiente: true, error: null });
    try {
      const c = await sesion(true);
      const { data, error } = await c!.rpc("alternar_favorita", { p_playa: f.playa, p_casilla: f.casilla });
      if (error) throw error;
      const nueva = (data as Favorita[]).at(-1) ?? null;
      guardarCopia(nueva);
      cambiar({ favorita: nueva, pendiente: false });
    } catch {
      cambiar({ favorita: antes, pendiente: false, error: "No se pudo guardar. Probá de nuevo." });
    }
  }, []);

  return { ...e, disponible: favoritaDisponible, alternar };
}

/** Pone primero la playa de la casilla favorita (el resto queda como venía). */
export function favoritaPrimero<T extends { slug: string }>(playas: T[], favorita: Favorita | null) {
  if (!favorita) return playas;
  return [...playas.filter((p) => p.slug === favorita.playa), ...playas.filter((p) => p.slug !== favorita.playa)];
}
