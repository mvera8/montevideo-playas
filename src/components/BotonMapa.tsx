import { IconArrowRight } from "@tabler/icons-react";
import Link from "next/link";

// Botón principal del sitio: lleva al mapa de playas. Se repite en la home, las novedades y el
// encabezado, así que va en un solo lugar. `href` permite usar el mismo botón para otro destino
// (p. ej. Contacto en las preguntas frecuentes).
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
      className={`group inline-flex items-center rounded-full font-semibold shadow-lg shadow-black/10 transition-colors ${TAMANOS[tamano]} ${TONOS[tono]} ${className}`}
    >
      {texto}
      <span
        aria-hidden
        className={`grid place-items-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 text-white transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none ${
          grande ? "h-11 w-11" : "-mr-2 h-6 w-6"
        }`}
      >
        <IconArrowRight className={grande ? "h-5 w-5" : "h-3.5 w-3.5"} stroke={2.4} />
      </span>
    </Link>
  );
}
