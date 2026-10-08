"use client";

import { IconAlertTriangleFilled } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { AdvertenciaInumet, AlertasInumet, NivelAlerta } from "@/lib/inumet";

// Advertencias meteorológicas de INUMET vigentes para Montevideo, arriba del panel y en el detalle de cada playa.
// Sin advertencias no se muestra nada; si no pudimos consultar a INUMET, se avisa en vez de callar.

const URL_INUMET = "https://www.inumet.gub.uy/alerta";

const NIVELES: Record<NivelAlerta, { label: string; clase: string; suave: string }> = {
  2: { label: "amarilla", clase: "bg-yellow-400 text-slate-900", suave: "text-slate-800" },
  3: { label: "naranja", clase: "bg-orange-500 text-white dark:bg-orange-600", suave: "text-orange-50" },
  4: { label: "roja", clase: "bg-red-700 text-white dark:bg-red-800", suave: "text-red-50" },
};

const horaFmt = new Intl.DateTimeFormat("es-UY", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Montevideo" });
const diaFmt = new Intl.DateTimeFormat("es-UY", { weekday: "long", day: "numeric", timeZone: "America/Montevideo" });

function cuando(iso: string, ahora: number) {
  const d = new Date(iso);
  const hoy = diaFmt.format(ahora) === diaFmt.format(d);
  return hoy ? `las ${horaFmt.format(d)}` : `el ${diaFmt.format(d)} a las ${horaFmt.format(d)}`;
}

export default function AlertaInumet({ alertas, className = "" }: { alertas: AlertasInumet | null; className?: string }) {
  // El mapa puede quedar abierto horas: cada minuto se descartan las que vencieron.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!alertas || alertas.estado === "sin-datos") {
    return (
      <p className={`rounded-2xl bg-white px-4 py-2.5 text-xs text-slate-500 ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/10 ${className}`}>
        Sin datos recientes de alertas de Inumet.{" "}
        <a href={URL_INUMET} target="_blank" rel="noreferrer" className="underline">
          Consultalas en inumet.gub.uy
        </a>
      </p>
    );
  }
  const vigentes = alertas.advertencias.filter((a) => !a.fin || Date.parse(a.fin) >= ahora);
  if (vigentes.length === 0) return null;
  return (
    <div className={`space-y-2 ${className}`}>
      {vigentes.map((a, i) => (
        <Advertencia key={i} adv={a} pdf={alertas.pdf} ahora={ahora} />
      ))}
    </div>
  );
}

function Advertencia({ adv, pdf, ahora }: { adv: AdvertenciaInumet; pdf: string | null; ahora: number }) {
  const n = NIVELES[adv.nivel];
  const futura = Date.parse(adv.comienzo) > ahora;
  return (
    <section className={`rounded-2xl p-4 shadow-sm ${n.clase}`}>
      <div className="flex items-center gap-2">
        <IconAlertTriangleFilled className="h-5 w-5 shrink-0" aria-hidden />
        <p className="font-semibold">Advertencia {n.label} de Inumet</p>
      </div>
      <p className="mt-1.5 text-sm font-medium">{adv.fenomeno}</p>
      <p className={`mt-1 text-xs ${n.suave}`}>
        {[
          adv.riesgos.join(", "),
          futura ? `Desde ${cuando(adv.comienzo, ahora)}` : adv.fin ? `Vigente hasta ${cuando(adv.fin, ahora)}` : null,
          adv.probabilidad && `Probabilidad ${adv.probabilidad}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {adv.localidades.length > 0 && (
        <p className={`mt-1 text-xs ${n.suave}`}>En Montevideo: {adv.localidades.join(", ")}.</p>
      )}
      {adv.descripcion && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-medium">Más detalles</summary>
          <p className={`mt-1 whitespace-pre-line ${n.suave}`}>{adv.descripcion}</p>
        </details>
      )}
      <p className="mt-2 text-xs">
        <a href={pdf ?? URL_INUMET} target="_blank" rel="noreferrer" className="font-medium underline">
          {pdf ? "Boletín oficial de Inumet (PDF)" : "Ver en inumet.gub.uy"}
        </a>
      </p>
    </section>
  );
}
