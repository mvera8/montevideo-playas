import type { Calidad, Motivo } from "@/lib/recomendacion";

// Colores de estado (siempre acompañados de texto, nunca solo color).
const CALIDAD: Record<Calidad, string> = {
  Ideal: "bg-emerald-100 text-emerald-800 dark:bg-oscuro-2 dark:text-emerald-300",
  Buena: "bg-teal-50 text-teal-800 dark:bg-oscuro-2 dark:text-teal-300",
  Aceptable: "bg-amber-100 text-amber-800 dark:bg-oscuro-2 dark:text-amber-300",
  "No recomendable": "bg-orange-100 text-orange-800 dark:bg-oscuro-2 dark:text-orange-300",
};

export function BadgeCalidad({ calidad, puntaje }: { calidad: Calidad; puntaje?: number }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${CALIDAD[calidad]}`}>
      {calidad}
      {puntaje !== undefined && <span className="font-normal tabular-nums opacity-70">{puntaje}</span>}
    </span>
  );
}

const ICONO = { bien: "✓", mal: "!", info: "i" } as const;
const TONO = {
  bien: "text-emerald-700 dark:text-emerald-400",
  mal: "text-orange-700 dark:text-orange-400",
  info: "text-slate-500 dark:text-neutral-400",
} as const;

export function Motivos({ motivos, max = 4 }: { motivos: Motivo[]; max?: number }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {motivos.slice(0, max).map((m) => (
        <li
          key={m.texto}
          className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-oscuro-3 dark:text-neutral-200"
        >
          <span className={`font-bold ${TONO[m.tono]}`} aria-hidden>
            {ICONO[m.tono]}
          </span>
          {m.texto}
        </li>
      ))}
    </ul>
  );
}
