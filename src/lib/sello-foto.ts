// Foto de playa con sello: arma en el navegador (Canvas 2D, sin librerías) una imagen con la foto y los
// datos de la playa en ese momento, lista para compartir. Nada sale del dispositivo: no se sube, no se
// guarda y no se cuenta. Al redibujar en Canvas se pierden los metadatos de la foto (EXIF, incluida la
// ubicación GPS que guardan muchos celulares).
//
// - Ancho fijo de 1080 px (ideal para redes) y alto proporcional, con tope de 1920 (historia vertical):
//   si la foto es más alta, se recorta al centro.
// - La orientación la corrige el navegador al dibujar un <img> (EXIF "from-image", Safari 13.1+/Chrome 81+).
// - Solo se pasan datos vigentes: quien llama no manda la bandera fuera de temporada ni el agua sin dato.
// - Diseño: hashtag en una píldora arriba a la derecha; abajo el nombre de la playa, una fila de datos
//   con íconos (cielo + aire, gota + agua, viento, bandera) y el logo con la casilla o la dirección.
//   Si la fila de datos no entra, se cortan los últimos; los textos largos terminan en "…".

import { ICONO_CIELO, ICONO_GOTA, ICONO_VIENTO, type EstadoCielo } from "./iconos-clima";

export type Sello = {
  playa: string;
  lugar: string; // casilla elegida ("Casilla 5 · Rambla …") o, si no hay, la ciudad
  cielo: EstadoCielo | null;
  aire: number | null;
  agua: number | null;
  viento: string | null; // "20 km/h SE"
  bandera: { label: string; color: string } | null;
};

export const HASHTAG = "#MontevideoPlayas";
const ANCHO = 1080;
const ALTO_MAX = 1920;
const AMARILLO = "#fcd34d";
const CELESTE = "#7dd3fc";

function cargarImagen(src: string) {
  return new Promise<HTMLImageElement>((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error("No se pudo leer la imagen"));
    img.src = src;
  });
}

// Achica la fuente hasta que el texto entre en `max` px.
function ajustar(ctx: CanvasRenderingContext2D, texto: string, peso: number, tam: number, max: number, familia: string) {
  let t = tam;
  do ctx.font = `${peso} ${t}px ${familia}`;
  while (ctx.measureText(texto).width > max && (t -= 4) > 24);
}

// Corta el texto con "…" hasta que entre en `max` px (con la fuente actual).
function recortar(ctx: CanvasRenderingContext2D, texto: string, max: number) {
  if (ctx.measureText(texto).width <= max) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

// Ícono de trazos (grilla 24×24) centrado verticalmente en `y`.
function icono(ctx: CanvasRenderingContext2D, trazos: string[], color: string, x: number, y: number, tam: number) {
  ctx.save();
  ctx.translate(x, y - tam / 2);
  ctx.scale(tam / 24, tam / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const d of trazos) ctx.stroke(new Path2D(d));
  ctx.restore();
}

export async function crearFotoConSello(archivo: File, sello: Sello): Promise<Blob> {
  const url = URL.createObjectURL(archivo);
  try {
    const [foto, logo] = await Promise.all([cargarImagen(url), cargarImagen("/logo.svg").catch(() => null)]);
    await document.fonts.ready;
    const familia = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";

    const alto = Math.min(Math.round((foto.naturalHeight / foto.naturalWidth) * ANCHO), ALTO_MAX);
    const canvas = document.createElement("canvas");
    canvas.width = ANCHO;
    canvas.height = alto;
    const ctx = canvas.getContext("2d")!;

    // Foto: ancho completo, recortada al centro si es más alta que el tope.
    const escala = ANCHO / foto.naturalWidth;
    const altoFoto = foto.naturalHeight * escala;
    ctx.drawImage(foto, 0, (alto - altoFoto) / 2, ANCHO, altoFoto);

    // Degradado abajo para que el texto se lea sobre cualquier foto.
    const altoAbajo = Math.min(alto * 0.55, 680);
    const abajo = ctx.createLinearGradient(0, alto - altoAbajo, 0, alto);
    abajo.addColorStop(0, "rgba(0,0,0,0)");
    abajo.addColorStop(0.45, "rgba(0,0,0,0.35)");
    abajo.addColorStop(1, "rgba(0,0,0,0.8)");
    ctx.fillStyle = abajo;
    ctx.fillRect(0, alto - altoAbajo, ANCHO, altoAbajo);

    const m = 56; // margen
    ctx.textBaseline = "middle";

    // Arriba a la derecha: hashtag en una píldora clara.
    ctx.font = `500 34px ${familia}`;
    const anchoPildora = ctx.measureText(HASHTAG).width + 64;
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.beginPath();
    ctx.roundRect(ANCHO - m - anchoPildora, m, anchoPildora, 72, 36);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.fillText(HASHTAG, ANCHO - m - anchoPildora + 32, m + 37);

    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 12;

    // Abajo, de abajo hacia arriba: logo + lugar, fila de datos y nombre de la playa.
    const yLugar = alto - m - 28;
    let x = m;
    if (logo) {
      const h = 56;
      const w = (logo.naturalWidth / logo.naturalHeight) * h || h * 1.25;
      ctx.drawImage(logo, m, yLugar - h / 2, w, h);
      x = m + w + 18;
    }
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = `400 36px ${familia}`;
    ctx.fillText(recortar(ctx, sello.lugar, ANCHO - m - x), x, yLugar);

    const yDatos = yLugar - 78;
    const datos: { icono: string[] | null; color: string; texto: string }[] = [
      ...(sello.aire != null ? [{ icono: sello.cielo && ICONO_CIELO[sello.cielo], color: sello.cielo === "sol" ? AMARILLO : "#fff", texto: `${sello.aire}°` }] : []),
      ...(sello.agua != null ? [{ icono: ICONO_GOTA, color: CELESTE, texto: `${sello.agua}°` }] : []),
      ...(sello.viento ? [{ icono: ICONO_VIENTO, color: "#fff", texto: sello.viento }] : []),
      ...(sello.bandera ? [{ icono: null, color: sello.bandera.color, texto: sello.bandera.label }] : []),
    ];
    ctx.font = `500 36px ${familia}`;
    const tamIcono = 40;
    const separador = 56; // espacio para la barra "|"
    x = m;
    for (const [i, d] of datos.entries()) {
      const ancho = tamIcono + 14 + ctx.measureText(d.texto).width;
      const inicio = i === 0 ? x : x + separador;
      if (inicio + ancho > ANCHO - m) break;
      if (i > 0) {
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(x + separador / 2 - 1.5, yDatos - 18, 3, 36);
      }
      if (d.icono) icono(ctx, d.icono, d.color, inicio, yDatos, tamIcono);
      else {
        // Bandera: punto del color, con borde para que la negra se vea sobre fondo oscuro.
        ctx.fillStyle = d.color;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(inicio + tamIcono / 2, yDatos, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = "#fff";
      ctx.fillText(d.texto, inicio + tamIcono + 14, yDatos + 2);
      x = inicio + ancho;
    }

    ctx.textBaseline = "alphabetic";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#fff";
    ajustar(ctx, sello.playa, 700, 108, ANCHO - 2 * m, familia);
    ctx.fillText(sello.playa, m, yDatos - (datos.length ? 52 : 0));

    return await new Promise<Blob>((ok, mal) =>
      canvas.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo crear la imagen"))), "image/jpeg", 0.9),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
