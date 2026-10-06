import Link from "next/link";

// Botón principal del sitio: lleva al mapa de playas. Se repite en la home, las novedades y el
// encabezado, así que va en un solo lugar.
const TAMANOS = {
  chico: "gap-2 px-4 py-2 text-sm",
  grande: "gap-3 py-2.5 pl-7 pr-2.5 text-lg",
};

const TONOS = {
  // Sobre fotos o fondos oscuros.
  claro: "bg-white text-slate-900 hover:bg-amber-50",
  // Sobre fondos claros.
  oscuro: "bg-slate-900 text-white hover:bg-slate-800",
};

export default function BotonMapa({
  tamano = "grande",
  tono = "oscuro",
  texto = "Abrir el mapa de playas",
  className = "",
}: {
  tamano?: keyof typeof TAMANOS;
  tono?: keyof typeof TONOS;
  texto?: string;
  className?: string;
}) {
  const grande = tamano === "grande";
  return (
    <Link
      href="/playas"
      className={`group inline-flex items-center rounded-full font-semibold shadow-lg shadow-black/10 transition-colors ${TAMANOS[tamano]} ${TONOS[tono]} ${className}`}
    >
      {texto}
      <span
        aria-hidden
        className={`grid place-items-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 text-white transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none ${
          grande ? "h-11 w-11" : "-mr-2 h-6 w-6"
        }`}
      >
        <svg viewBox="0 0 24 24" className={grande ? "h-5 w-5" : "h-3.5 w-3.5"} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}
