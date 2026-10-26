import type { Chequeo, Estado } from "@/lib/estado";

// Una fuente en /estado. La usan los chequeos del servidor (page.tsx) y los del navegador
// (DesdeNavegador.tsx); "cargando" es solo del navegador, mientras espera la respuesta.
const ESTADOS: Record<Estado | "cargando", { texto: string; punto: string; tinta: string }> = {
  ok: { texto: "Funciona", punto: "bg-emerald-500", tinta: "text-emerald-700" },
  viejo: { texto: "Datos viejos", punto: "bg-amber-400", tinta: "text-amber-700" },
  caido: { texto: "No responde", punto: "bg-red-500", tinta: "text-red-700" },
  cargando: { texto: "Verificando…", punto: "bg-slate-300", tinta: "text-slate-500" },
};

export type FilaEstado = Pick<Chequeo, "nombre" | "usa" | "detalle"> & { estado: Estado | "cargando"; ms: number | null };

export default function Fila({ c }: { c: FilaEstado }) {
  const e = ESTADOS[c.estado];
  return (
    <li className="p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-slate-900">{c.nombre}</p>
        <p className={`flex shrink-0 items-center gap-2 text-sm font-medium ${e.tinta}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${e.punto}`} aria-hidden />
          {e.texto}
        </p>
      </div>
      <p className={`mt-1 text-sm break-words ${c.estado === "caido" ? "font-mono text-xs text-red-700" : "text-slate-600"}`}>
        {c.detalle}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {c.usa}
        {c.ms != null && ` · ${c.ms < 1000 ? `${c.ms} ms` : `${(c.ms / 1000).toFixed(1)} s`}`}
      </p>
    </li>
  );
}
