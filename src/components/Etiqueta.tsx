// Pastilla con borde para encabezar secciones ("Qué es Playas UY", "Novedades"…).
// `foto`: versión translúcida para poner sobre imágenes.
const TONOS = {
  claro: "text-slate-600 ring-slate-300",
  foto: "bg-white/10 text-white ring-white/30 backdrop-blur",
};

export default function Etiqueta({
  children,
  tono = "claro",
  punto = false,
  className = "",
}: {
  children: React.ReactNode;
  tono?: keyof typeof TONOS;
  punto?: boolean;
  className?: string;
}) {
  return (
    <p className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ring-1 ${TONOS[tono]} ${className}`}>
      {punto && <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />}
      {children}
    </p>
  );
}
