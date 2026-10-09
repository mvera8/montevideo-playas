import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

// Botón principal del sitio: lleva al mapa de playas. Se repite en la home, las novedades y el
// encabezado, así que va en un solo lugar. `href` permite usar el mismo botón para otro destino
// (p. ej. Contacto en las preguntas frecuentes).
// Relleno de 8 × 12 px y letra de 16 px (14 px en el encabezado), como pide la skill landing-page-design.
const TAMANOS = {
  chico: "gap-2 px-3 py-2 text-sm",
  grande: "gap-3 px-3 py-2 text-base",
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
  href = "/playas",
}: {
  tamano?: keyof typeof TAMANOS;
  tono?: keyof typeof TONOS;
  texto?: string;
  className?: string;
  href?: string;
}) {
  const grande = tamano === "grande";
  return (
    <Link
      href={href}
      className={`group inline-flex items-center rounded-full font-semibold shadow-lg shadow-black/10 transition duration-700 ease-fluido hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] motion-reduce:transition-none ${TAMANOS[tamano]} ${TONOS[tono]} ${className}`}
    >
      {texto}
      <span
        aria-hidden
        className={`grid place-items-center rounded-full bg-amber-400 text-slate-900 transition-transform duration-700 ease-fluido group-hover:translate-x-0.5 motion-reduce:transition-none ${
          grande ? "h-6 w-6" : "h-4 w-4"
        }`}
      >
        <ArrowRight className={grande ? "h-4 w-4" : "h-3 w-3"} weight="bold" />
      </span>
    </Link>
  );
}
