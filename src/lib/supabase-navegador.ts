"use client";

// Cliente de Supabase del navegador, compartido por los me gusta (me-gusta-cliente.ts) y la playa
// favorita (favorita-cliente.ts): una sola cuenta anónima (Supabase Auth, signInAnonymously) y una
// sola sesión por navegador. supabase-js (~45 kB gz) se importa recién cuando hace falta.

import type { SupabaseClient } from "@supabase/supabase-js";

export const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const CLAVE_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseDisponible = Boolean(URL_SUPABASE && CLAVE_SUPABASE);

let cliente: Promise<SupabaseClient> | null = null;
function getCliente() {
  cliente ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(URL_SUPABASE!, CLAVE_SUPABASE!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    }),
  );
  return cliente;
}

// supabase-js guarda la sesión en localStorage con la clave `sb-<ref>-auth-token`.
export function haySesion() {
  try {
    const ref = new URL(URL_SUPABASE!).hostname.split(".")[0];
    return localStorage.getItem(`sb-${ref}-auth-token`) != null;
  } catch {
    return false;
  }
}

/** Cliente con sesión. Sin sesión: crea la cuenta anónima si `crearCuenta`, si no devuelve null. */
export async function sesion(crearCuenta: boolean) {
  const c = await getCliente();
  const { data } = await c.auth.getSession();
  if (data.session) return c;
  if (!crearCuenta) return null;
  const { error } = await c.auth.signInAnonymously();
  if (error) throw error;
  return c;
}
