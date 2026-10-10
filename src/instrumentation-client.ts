import { reportarErrorCliente } from "./lib/errores";

// Errores del navegador fuera de React (handlers de eventos, el mapa, promesas sin catch): los de
// render ya los atrapan error.tsx y global-error.tsx. Next corre este archivo antes de que la página sea
// interactiva, así que también cubre la carga. Se registran en Supabase (src/lib/errores.ts).

window.addEventListener("error", (ev) => {
  // Solo scripts propios: los de otro origen llegan sin datos ("Script error.") y no son nuestros.
  if (ev.filename && !ev.filename.startsWith(location.origin)) return;
  reportarErrorCliente(ev.error ?? ev.message, "window.error", `${ev.filename}:${ev.lineno}:${ev.colno}`);
});

window.addEventListener("unhandledrejection", (ev) => {
  reportarErrorCliente(ev.reason, "unhandledrejection");
});
