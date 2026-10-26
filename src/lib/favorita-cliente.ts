"use client";

// Casillas favoritas desde el navegador (README → "Casillas favoritas"). Hasta 3 por persona
// (`TOPE_FAVORITAS`, mismo tope que el trigger de la base), con la misma cuenta anónima de los me gusta
// (supabase-navegador.ts). Tabla `casilla_favorita` con RLS (cada uno ve y cambia solo las suyas) y
// función `alternar_favorita(p_playa, p_casilla)`: agrega o saca y devuelve todas, en un viaje. Se
// guarda la casilla (id de la IM) y su playa: la playa ordena el listado, la casilla lleva la estrella
// 3D y el aviso de bandera verde.
//
// Performance: las favoritas se copian en localStorage (`favoritas`, JSON) para ordenar el listado al
// instante sin bajar supabase-js. La base manda: si el navegador tiene sesión, al cargar se leen (hasta
// 3 filas, por RLS solo las propias) y se corrige la copia. Sin sesión no hay favoritas y no se pide nada.

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { haySesion, sesion, supabaseDisponible } from "./supabase-navegador";

export const favoritaDisponible = supabaseDisponible;

export type Favorita = { playa: string; casilla: string };

export const TOPE_FAVORITAS = 3;

const CLAVE_LOCAL = "favoritas";

function leerCopia(): Favorita[] {
  try {
    localStorage.removeItem("favorita"); // copia de cuando había una sola
    const f = JSON.parse(localStorage.getItem(CLAVE_LOCAL) ?? "[]");
    return Array.isArray(f) ? f.filter((x) => typeof x?.playa === "string" && typeof x?.casilla === "string") : [];
  } catch {
    return [];
  }
}

function guardarCopia(f: Favorita[]) {
  try {
    if (f.length) localStorage.setItem(CLAVE_LOCAL, JSON.stringify(f));
    else localStorage.removeItem(CLAVE_LOCAL);
  } catch {}
}

type Estado = {
  favoritas: Favorita[];
  cargada: boolean;
  pendiente: boolean;
  error: string | null;
  tope: boolean; // quiso agregar una más con el tope lleno: Favorita.tsx muestra el modal
};

let estado: Estado = { favoritas: [], cargada: false, pendiente: false, error: null, tope: false };
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
    guardarCopia([]);
    cambiar({ favoritas: [], cargada: true });
    return;
  }
  cambiar({ favoritas: leerCopia() });
  sesion(false)
    .then(async (c) => {
      if (!c) return [];
      const { data, error } = await c.from("casilla_favorita").select("playa,casilla").order("actualizado");
      if (error) throw error;
      return data as Favorita[];
    })
    .then((f) => {
      if (elegidaEnEstaCarga) return;
      guardarCopia(f);
      cambiar({ favoritas: f });
    })
    .catch(() => {}) // sin conexión: queda la copia local
    .finally(() => cambiar({ cargada: true }));
}

/** Casillas favoritas del navegador y la acción de agregar o sacar una, con actualización optimista. */
export function useFavoritas() {
  const e = useSyncExternalStore(suscribir, () => estado, () => estado);
  useEffect(cargar, []);

  const alternar = useCallback(async (f: Favorita) => {
    if (estado.pendiente) return;
    const antes = estado.favoritas;
    const esta = antes.some((x) => x.casilla === f.casilla);
    if (!esta && antes.length >= TOPE_FAVORITAS) {
      cambiar({ tope: true });
      return;
    }
    elegidaEnEstaCarga = true;
    cambiar({
      favoritas: esta ? antes.filter((x) => x.casilla !== f.casilla) : [...antes, f],
      pendiente: true,
      error: null,
    });
    try {
      const c = await sesion(true);
      const { data, error } = await c!.rpc("alternar_favorita", { p_playa: f.playa, p_casilla: f.casilla });
      if (error) throw error;
      guardarCopia(data as Favorita[]);
      cambiar({ favoritas: data as Favorita[], pendiente: false });
    } catch (err) {
      // check_violation: el tope de la base (p. ej. eligió desde otra pestaña con la copia vieja).
      const tope = (err as { code?: string })?.code === "23514";
      cambiar({ favoritas: antes, pendiente: false, tope, error: tope ? null : "No se pudo guardar. Probá de nuevo." });
    }
  }, []);

  const cerrarTope = useCallback(() => cambiar({ tope: false }), []);

  return { ...e, disponible: favoritaDisponible, alternar, cerrarTope };
}

/** Pone primero las playas con casillas favoritas (en orden alfabético entre ellas, como el resto). */
export function favoritasPrimero<T extends { slug: string }>(playas: T[], favoritas: Favorita[]) {
  if (!favoritas.length) return playas;
  const conFavorita = new Set(favoritas.map((f) => f.playa));
  return [...playas.filter((p) => conFavorita.has(p.slug)), ...playas.filter((p) => !conFavorita.has(p.slug))];
}
