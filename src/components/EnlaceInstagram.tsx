import { InstagramLogo } from "@phosphor-icons/react/dist/ssr";
import { SITIO } from "@/lib/sitio";

// Enlace a la cuenta de Instagram del sitio. `variante`: "icono" (botón redondo del encabezado, con
// `claro` encima de la foto de la home) o "texto" ("Seguinos en Instagram", para el pie). En "icono",
// `className` reemplaza el display (inline-flex) para poder ocultarlo por breakpoint.
export default function EnlaceInstagram({
  variante = "icono",
  claro = false,
  className = "",
}: {
  variante?: "icono" | "texto";
  claro?: boolean;
  className?: string;
}) {
  if (variante === "texto") {
    return (
      <a
        href={SITIO.instagram}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 text-sm text-neutral-300 hover:text-white hover:underline ${className}`}
      >
        <InstagramLogo size={20} weight="regular" aria-hidden />
        <span>
          Seguinos en <span className="font-semibold text-white">Instagram</span>
        </span>
      </a>
    );
  }
  return (
    <a
      href={SITIO.instagram}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Seguinos en Instagram"
      title="Seguinos en Instagram"
      className={`size-9 items-center justify-center rounded-full transition-colors duration-700 ease-fluido ${
        claro ? "text-white/85 hover:bg-white/15 hover:text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      } ${className || "inline-flex"}`}
    >
      <InstagramLogo size={20} weight="regular" aria-hidden />
    </a>
  );
}
