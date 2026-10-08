import type { Guardavidas } from "@/lib/playas";

// Bandera sanitaria de la IM ("no apta para baños"): paño rojo con cruz verde. Mismos colores que el
// paño de la casilla 3D (capa-casillas.ts) y que el sitio de la IM.
export const SANITARIA = { fondo: "#d62828", cruz: "#1f9d4c" };

export function IconoBanderaSanitaria({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={`shrink-0 ${className}`} role="img" aria-label="Bandera sanitaria">
      <rect width="12" height="12" rx="2" fill={SANITARIA.fondo} />
      <path d="M4.8 2h2.4v2.8H10v2.4H7.2V10H4.8V7.2H2V4.8h2.8z" fill={SANITARIA.cruz} />
    </svg>
  );
}

/** Aviso de bandera sanitaria de una casilla (lista de casillas). */
export function AvisoSanitaria({ sanitaria }: { sanitaria: NonNullable<Guardavidas["banderaSanitaria"]> }) {
  return (
    <span className="mt-1 flex items-start gap-1.5 text-xs text-red-700 dark:text-red-400">
      <IconoBanderaSanitaria className="mt-0.5 h-3 w-3" />
      <span>
        <span className="font-medium">No apta para baños{sanitaria.causa ? ` · ${sanitaria.causa}` : ""}</span>
        {sanitaria.detalle && <span className="block text-slate-600 dark:text-slate-400">{sanitaria.detalle}</span>}
      </span>
    </span>
  );
}
