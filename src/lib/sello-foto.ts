// Foto de playa con sello: arma en el navegador (Canvas 2D, sin librerías) una imagen con la foto y los
// datos de la playa en ese momento, lista para compartir. Nada sale del dispositivo: no se sube, no se
// guarda y no se cuenta. Al redibujar en Canvas se pierden los metadatos de la foto (EXIF, incluida la
// ubicación GPS que guardan muchos celulares).
//
// - Ancho fijo de 1080 px (ideal para redes) y alto proporcional, con tope de 1920 (historia vertical):
//   si la foto es más alta, se recorta al centro.
// - La orientación la corrige el navegador al dibujar un <img> (EXIF "from-image", Safari 13.1+/Chrome 81+).
// - Solo se pasan datos vigentes: quien llama no manda la bandera fuera de temporada ni el agua sin dato.

export type Sello = {
  playa: string;
  datos: string[]; // "Aire 16°", "Agua 16°", "Viento 20 km/h SE"…
  bandera: { label: string; color: string } | null;
};

export const HASHTAG = "#MontevideoPlayas";
const ANCHO = 1080;
const ALTO_MAX = 1920;
const DORADO = "#e8c064";

function cargarImagen(src: string) {
  return new Promise<HTMLImageElement>((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error("No se pudo leer la imagen"));
    img.src = src;
  });
}

const fechaHora = () =>
  new Intl.DateTimeFormat("es-UY", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Montevideo",
  }).format(new Date());

// Achica la fuente hasta que el texto entre en `max` px.
function ajustar(ctx: CanvasRenderingContext2D, texto: string, peso: number, tam: number, max: number, familia: string) {
  let t = tam;
  do ctx.font = `${peso} ${t}px ${familia}`;
  while (ctx.measureText(texto).width > max && (t -= 4) > 24);
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

    // Degradados para que el texto se lea sobre cualquier foto.
    const arriba = ctx.createLinearGradient(0, 0, 0, 260);
    arriba.addColorStop(0, "rgba(0,0,0,0.55)");
    arriba.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = arriba;
    ctx.fillRect(0, 0, ANCHO, 260);
    const altoAbajo = Math.min(alto * 0.5, 620);
    const abajo = ctx.createLinearGradient(0, alto - altoAbajo, 0, alto);
    abajo.addColorStop(0, "rgba(0,0,0,0)");
    abajo.addColorStop(1, "rgba(0,0,0,0.8)");
    ctx.fillStyle = abajo;
    ctx.fillRect(0, alto - altoAbajo, ANCHO, altoAbajo);

    const m = 56; // margen
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 12;

    // Arriba a la izquierda: logo + marca.
    let x = m;
    if (logo) {
      const h = 76;
      const w = (logo.naturalWidth / logo.naturalHeight) * h || h * 1.25;
      ctx.drawImage(logo, m, m - 4, w, h);
      x = m + w + 18;
    }
    ctx.fillStyle = "#fff";
    ctx.font = `600 40px ${familia}`;
    ctx.fillText("Montevideo", x, m + 34);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `400 30px ${familia}`;
    ctx.fillText("Playas", x, m + 70);

    // Arriba a la derecha: fecha y hora.
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = `500 34px ${familia}`;
    ctx.fillText(fechaHora(), ANCHO - m, m + 34);
    ctx.textAlign = "left";

    // Abajo: hashtag, datos y nombre de la playa (de abajo hacia arriba).
    let y = alto - m;
    ctx.fillStyle = DORADO;
    ctx.font = `600 38px ${familia}`;
    ctx.fillText(HASHTAG, m, y);
    y -= 66;

    // Fichas de datos en una fila (se cortan si no entran).
    ctx.shadowBlur = 0;
    const fichas = [...(sello.bandera ? [sello.bandera.label] : []), ...sello.datos];
    ctx.font = `500 32px ${familia}`;
    let fx = m;
    for (const [i, texto] of fichas.entries()) {
      const conPunto = i === 0 && sello.bandera;
      const ancho = ctx.measureText(texto).width + 44 + (conPunto ? 34 : 0);
      if (fx + ancho > ANCHO - m) break;
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.roundRect(fx, y - 42, ancho, 60, 30);
      ctx.fill();
      let tx = fx + 22;
      if (conPunto) {
        ctx.fillStyle = sello.bandera!.color;
        ctx.beginPath();
        ctx.arc(tx + 10, y - 12, 11, 0, Math.PI * 2);
        ctx.fill();
        tx += 34;
      }
      ctx.fillStyle = "#fff";
      ctx.fillText(texto, tx, y);
      fx += ancho + 14;
    }
    y -= 78;

    ctx.shadowBlur = 16;
    ctx.fillStyle = "#fff";
    ajustar(ctx, sello.playa, 700, 104, ANCHO - 2 * m, familia);
    ctx.fillText(sello.playa, m, y);

    return await new Promise<Blob>((ok, mal) =>
      canvas.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo crear la imagen"))), "image/jpeg", 0.9),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
