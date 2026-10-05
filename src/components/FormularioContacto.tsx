"use client";

import { useActionState } from "react";
import Link from "next/link";
import { enviarMensaje, type EstadoContacto } from "@/app/contacto/acciones";

// Formulario de /contacto. Envía con una Server Action (funciona aun sin JavaScript) y muestra el
// resultado debajo. Los límites de largo coinciden con LIMITES de src/lib/contacto.ts.
const CAMPO =
  "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

export default function FormularioContacto() {
  const [estado, accion, enviando] = useActionState<EstadoContacto, FormData>(enviarMensaje, null);

  if (estado?.ok) {
    return (
      <p role="status" className="mt-8 rounded-2xl border border-sky-200 bg-white p-5 dark:border-sky-900 dark:bg-slate-900">
        {estado.mensaje}
      </p>
    );
  }

  return (
    <form action={accion} className="mt-8 space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Nombre
          <input name="nombre" required maxLength={100} autoComplete="name" className={CAMPO} />
        </label>
        <label className="block text-sm font-medium">
          Correo
          <input name="correo" type="email" required maxLength={200} autoComplete="email" className={CAMPO} />
        </label>
      </div>
      <label className="block text-sm font-medium">
        Mensaje
        <textarea name="mensaje" required minLength={5} maxLength={5000} rows={6} className={CAMPO} />
      </label>
      {/* Trampa para bots: oculta para personas y lectores de pantalla. */}
      <input name="sitio_web" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

      <p className="text-sm text-slate-500">
        Usamos tu nombre y correo solo para responderte. Más detalles en la{" "}
        <Link href="/privacidad#contacto" className="text-sky-700 underline dark:text-sky-300">
          política de privacidad
        </Link>
        .
      </p>
      {estado && !estado.ok && (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {estado.mensaje}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="rounded-xl bg-sky-600 px-5 py-2.5 font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {enviando ? "Enviando…" : "Enviar mensaje"}
      </button>
    </form>
  );
}
