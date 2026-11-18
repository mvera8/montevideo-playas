/** Ruedita de carga del tamaño del texto, en el color del texto (gira con `transform`). Va junto a un texto que dice qué se carga. */
export default function Cargando({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent opacity-70 motion-reduce:animate-none ${className}`}
    />
  );
}
