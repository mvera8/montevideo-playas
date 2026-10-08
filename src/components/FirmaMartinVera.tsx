// Firma "creado por martínvera ↗" con el logo de https://martinvera.com.uy (texto en minúsculas,
// peso 900, fuente del sistema como en ese sitio, y la flecha arrow-up-right de Tabler en un cuadradito).
// Autocontenido a propósito para copiarlo tal cual a otros sitios: sin Tailwind, sin next/link ni
// dependencias; el CSS va en un <style> que React 19 sube al <head> y no duplica (href + precedence).
// `color`: letras y flecha (blanco por defecto, para fondos oscuros). `etiqueta`: texto antes del logo.

const CSS = `
.firma-mv{display:inline-flex;align-items:center;gap:.5rem;text-decoration:none;color:var(--firma-mv-color);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1}
.firma-mv__etiqueta{font-size:.75rem;font-weight:400;opacity:.7}
.firma-mv__logo{display:inline-flex;align-items:center;gap:.3125rem;transition:opacity .2s}
.firma-mv__nombre{font-size:1.125rem;font-weight:900;text-transform:lowercase;letter-spacing:-.01em}
.firma-mv__flecha{display:inline-grid;place-items:center;width:1.375rem;height:1.375rem;border-radius:.5rem;
  background:color-mix(in srgb,currentColor 15%,transparent);transition:transform .2s}
.firma-mv:hover .firma-mv__flecha,.firma-mv:focus-visible .firma-mv__flecha{transform:translate(2px,-2px)}
.firma-mv:hover .firma-mv__logo{opacity:.85}
@media (prefers-reduced-motion:reduce){.firma-mv__flecha,.firma-mv__logo{transition:none}}
`;

export default function FirmaMartinVera({
  color = "#fff",
  etiqueta = "creado por",
  className = "",
}: {
  color?: string;
  etiqueta?: string;
  className?: string;
}) {
  return (
    <>
      <style href="firma-martin-vera" precedence="default">
        {CSS}
      </style>
      <a
        href="https://martinvera.com.uy"
        target="_blank"
        rel="noopener"
        aria-label="Creado por Martín Vera (martinvera.com.uy)"
        className={`firma-mv ${className}`}
        style={{ "--firma-mv-color": color } as React.CSSProperties}
      >
        {etiqueta && <span className="firma-mv__etiqueta">{etiqueta}</span>}
        <span className="firma-mv__logo">
          <span className="firma-mv__nombre">MartínVera</span>
          <span className="firma-mv__flecha" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 7l-10 10" />
              <path d="M8 7l9 0l0 9" />
            </svg>
          </span>
        </span>
      </a>
    </>
  );
}
