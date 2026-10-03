import type { Map as MapLibreMap } from "maplibre-gl";
import type { Servicio } from "@/lib/servicios";

export const SERVICIO: Record<Servicio["tipo"], { nombre: string; color: string; icono: string }> = {
  bano: { nombre: "Baño", color: "#7c3aed", icono: "🚻" },
  bebedero: { nombre: "Bebedero", color: "#0891b2", icono: "🚰" },
  ducha: { nombre: "Ducha", color: "#0d9488", icono: "🚿" },
};

// Glifos simples dibujados en SVG (no dependen de fuentes del mapa).
const GLIFO: Record<Servicio["tipo"], string> = {
  bano: `<text x="22" y="27.5" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#fff">WC</text>`,
  bebedero: `<path d="M22 11c0 0-7 8.2-7 12.6a7 7 0 0 0 14 0C29 19.2 22 11 22 11Z" fill="#fff"/>`,
  ducha: `<path d="M14 15h11a5 5 0 0 1 5 5v1H14z" fill="#fff"/><g fill="#fff"><circle cx="17" cy="25" r="1.4"/><circle cx="21" cy="27" r="1.4"/><circle cx="25" cy="25" r="1.4"/><circle cx="19" cy="30" r="1.4"/><circle cx="23" cy="31" r="1.4"/></g>`,
};

/** Registra los íconos (círculo de color + glifo blanco) a 2x para pantallas de alta densidad. */
export function cargarIconos(map: MapLibreMap) {
  for (const [tipo, s] of Object.entries(SERVICIO) as [Servicio["tipo"], (typeof SERVICIO)["bano"]][]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><circle cx="22" cy="22" r="18" fill="${s.color}" stroke="#fff" stroke-width="3"/>${GLIFO[tipo]}</svg>`;
    const img = new Image(44, 44);
    img.onload = () => {
      if (!map.hasImage(`servicio-${tipo}`)) map.addImage(`servicio-${tipo}`, img, { pixelRatio: 2 });
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function hace(dias: number) {
  if (dias < 45) return dias <= 1 ? "hace 1 día" : `hace ${dias} días`;
  if (dias < 730) return `hace ${Math.round(dias / 30.4)} meses`;
  return `hace ${Math.floor(dias / 365.25)} años`;
}

/**
 * "Última edición en OSM: sep 2017 (hace 9 años)"; corto: "editado sep 2017 (hace 9 años)".
 * null si el dato no tiene fecha (los de la IM).
 */
export function textoFecha(s: Servicio, corto = false): string | null {
  const a = s.actualizado;
  if (!a) return null;
  const [anio, mes] = a.fecha.split("-");
  const cuando = `${MESES[Number(mes) - 1]} ${anio} (${hace(a.dias)})`;
  if (a.tipo === "verificado") return `${corto ? "verificado" : "Verificado:"} ${cuando}`;
  return `${corto ? "editado" : "Última edición en OSM:"} ${cuando}`;
}

export const AVISO_VIEJO = "Dato viejo: puede no existir o estar cerrado.";

/** Contenido del popup armado con DOM y textContent (los datos de OSM son texto libre). */
export function contenidoPopup(s: Servicio): HTMLElement {
  const div = document.createElement("div");
  div.className = "text-sm text-slate-800";
  const linea = (texto: string, clase = "") => {
    const p = document.createElement("p");
    p.textContent = texto;
    if (clase) p.className = clase;
    div.appendChild(p);
  };
  linea(`${SERVICIO[s.tipo].icono} ${s.detalle}`, "font-semibold");
  if (s.horario) linea(`Horario: ${s.horario}`);
  if (s.accesible != null) linea(s.accesible ? "♿ Accesible" : "No accesible en silla de ruedas");
  linea(s.fuente === "IM" ? "Fuente: Intendencia de Montevideo" : "Fuente: OpenStreetMap (comunitario)", "mt-1 text-xs text-slate-500");
  const fecha = textoFecha(s);
  if (fecha) linea(fecha, "text-xs text-slate-500");
  if (s.viejo) linea(AVISO_VIEJO, "text-xs font-medium text-orange-700");
  return div;
}
