"use server";

import { headers } from "next/headers";
import { contactoActivo, enviarContacto, LIMITES, superaLimite } from "@/lib/contacto";

export type EstadoContacto = { ok: boolean; mensaje: string } | null;

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function enviarMensaje(_previo: EstadoContacto, datos: FormData): Promise<EstadoContacto> {
  // Campo trampa: invisible para personas; si viene lleno es un bot. Se responde "ok" para no darle pistas.
  if (datos.get("sitio_web")) return { ok: true, mensaje: "¡Gracias! Recibimos tu mensaje." };

  if (!contactoActivo()) return { ok: false, mensaje: "El formulario todavía no está activo." };

  const nombre = String(datos.get("nombre") ?? "").trim();
  const correo = String(datos.get("correo") ?? "").trim();
  const mensaje = String(datos.get("mensaje") ?? "").trim();

  if (!nombre || nombre.length > LIMITES.nombre) return { ok: false, mensaje: "Revisá tu nombre." };
  if (!CORREO.test(correo) || correo.length > LIMITES.correo) return { ok: false, mensaje: "Revisá tu correo." };
  if (mensaje.length < 5 || mensaje.length > LIMITES.mensaje) return { ok: false, mensaje: "Escribí un mensaje." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
  if (superaLimite(ip)) return { ok: false, mensaje: "Enviaste varios mensajes seguidos. Probá de nuevo en un rato." };

  try {
    await enviarContacto({ nombre, correo, mensaje });
    return { ok: true, mensaje: "¡Gracias! Recibimos tu mensaje y te vamos a responder a tu correo." };
  } catch (e) {
    console.error("[contacto]", e instanceof Error ? e.message : e);
    return { ok: false, mensaje: "No pudimos enviar el mensaje. Probá de nuevo más tarde." };
  }
}
