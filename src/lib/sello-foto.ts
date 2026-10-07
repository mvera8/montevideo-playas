// Foto de playa con sello: arma en el navegador (Canvas 2D, sin librerías) una imagen con la foto y los
// datos de la playa en ese momento, lista para compartir. Nada sale del dispositivo: no se sube, no se
// guarda y no se cuenta. Al redibujar en Canvas se pierden los metadatos de la foto (EXIF, incluida la
// ubicación GPS que guardan muchos celulares).
//
// - Ancho fijo de 1080 px (ideal para redes) y alto proporcional, con tope de 1920 (historia vertical):
//   si la foto es más alta, se recorta al centro.
// - La orientación la corrige el navegador al dibujar un <img> (EXIF "from-image", Safari 13.1+/Chrome 81+).
// - Solo se pasan datos vigentes: fuera de temporada (o sin dato de la IM) la bandera va en gris.
// - Diseño: hashtag en una píldora arriba a la derecha y abajo dos tarjetas de vidrio esmerilado (la
//   foto desenfocada detrás, como las tarjetas de la home): arriba el logo y el nombre de la playa;
//   abajo cielo + aire, viento, bandera (ícono del color vigente) y me gusta de la temporada. Íconos en
//   blanco salvo el paño de la bandera. Si la foto es horizontal, las tarjetas van en una columna a la
//   derecha (a todo el ancho tapaban media foto).
// - El desenfoque usa `ctx.filter` (Safari 18+, Chrome); si no está, se achica y se vuelve a agrandar
//   la foto, que da un borroso parecido.

import { ICONO_CIELO, ICONO_VIENTO, type EstadoCielo } from "./iconos-clima";

export type Sello = {
  playa: string;
  cielo: EstadoCielo | null;
  aire: number | null;
  viento: string | null; // "20 km/h SE"
  bandera: string; // color de la bandera vigente; gris si no hay
  meGusta: number | null; // de esta temporada; null si el servicio no está disponible
};

export const HASHTAG = "#MontevideoPlayas";
const ANCHO = 1080;
const ALTO_MAX = 1920;
const numero = new Intl.NumberFormat("es-UY");
// Mismo corazón que MeGusta.tsx; bandera: mástil y paño (el paño se rellena con el color).
const CORAZON = "M12 20.5s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1Z";
const MASTIL = "M5.5 21.5V3";
const PANO = "M5.5 4h12l-2.6 4.25L17.5 12.5h-12Z";

function cargarImagen(src: string) {
  return new Promise<HTMLImageElement>((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error("No se pudo leer la imagen"));
    img.src = src;
  });
}

// Achica la fuente hasta que el texto entre en `max` px; devuelve el tamaño elegido.
function ajustar(ctx: CanvasRenderingContext2D, texto: string, peso: number, tam: number, max: number, familia: string) {
  let t = tam;
  do ctx.font = `${peso} ${t}px ${familia}`;
  while (ctx.measureText(texto).width > max && (t -= 4) > 24);
  return t;
}

// Corta el texto con "…" hasta que entre en `max` px (con la fuente actual).
function recortar(ctx: CanvasRenderingContext2D, texto: string, max: number) {
  if (ctx.measureText(texto).width <= max) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

// Copia de la foto desenfocada, para el fondo de las tarjetas de vidrio.
function desenfocar(origen: HTMLCanvasElement) {
  const { width: w, height: h } = origen;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.filter = "blur(36px)";
  if (ctx.filter === "blur(36px)") {
    // Un poco más grande que el lienzo: en los bordes el blur mezclaría con transparente.
    ctx.drawImage(origen, -80, -80, w + 160, h + 160);
    return c;
  }
  const chico = document.createElement("canvas");
  chico.width = Math.ceil(w / 28);
  chico.height = Math.ceil(h / 28);
  const cc = chico.getContext("2d")!;
  cc.imageSmoothingQuality = "high";
  cc.drawImage(origen, 0, 0, chico.width, chico.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(chico, 0, 0, w, h);
  return c;
}

// Tarjeta de vidrio: foto desenfocada recortada, un velo oscuro para leer el texto y borde claro.
function vidrio(ctx: CanvasRenderingContext2D, borroso: HTMLCanvasElement, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 40);
  ctx.clip();
  ctx.drawImage(borroso, 0, 0);
  ctx.fillStyle = "rgba(15,23,42,0.3)";
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, w - 2, h - 2, 39);
  ctx.stroke();
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

    const borroso = desenfocar(canvas);
    const m = 48; // margen
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

    // Dos tarjetas de vidrio abajo (de abajo hacia arriba). Foto vertical: a todo el ancho, con los
    // datos en una fila. Foto horizontal: en una columna a la derecha (si no, tapaban media foto), con
    // los datos en dos filas.
    const horizontal = foto.naturalWidth > foto.naturalHeight;
    const w = horizontal ? 500 : ANCHO - 2 * m;
    const xCard = ANCHO - m - w;
    const pad = horizontal ? 32 : 40; // relleno interno
    const porFila = horizontal ? 2 : 4;
    const altoFila = 116;
    const altoDatos = horizontal ? 2 * 84 + 24 : altoFila;
    const yDatos = alto - m - altoDatos;
    // Tarjeta de arriba: logo + nombre de la playa. Si el nombre no entra en una línea, pasa a dos
    // (partido por palabras) antes de achicar la letra.
    const hLogo = horizontal ? 72 : 88;
    const anchoLogo = logo ? (logo.naturalWidth / logo.naturalHeight) * hLogo || hLogo * 1.25 : 0;
    const xTexto = xCard + pad + (logo ? anchoLogo + (horizontal ? 18 : 24) : 0);
    const maxTexto = xCard + w - pad - xTexto;
    const tamNombre = horizontal ? 60 : 76;
    ctx.font = `700 ${tamNombre}px ${familia}`;
    let lineas = [sello.playa];
    if (ctx.measureText(sello.playa).width > maxTexto) {
      const palabras = sello.playa.split(" ");
      const cortes = palabras.slice(1).map((_, i) => [palabras.slice(0, i + 1).join(" "), palabras.slice(i + 1).join(" ")]);
      const mejor = cortes.sort((p, q) => Math.max(...p.map((l) => ctx.measureText(l).width)) - Math.max(...q.map((l) => ctx.measureText(l).width)))[0];
      if (mejor) lineas = mejor;
    }
    const masAncha = lineas.reduce((p, l) => (ctx.measureText(l).width > ctx.measureText(p).width ? l : p));
    const interlinea = ajustar(ctx, masAncha, 700, tamNombre, maxTexto, familia) * 1.1;
    const altoNombre = Math.max(horizontal ? 132 : 156, Math.round(lineas.length * interlinea + 2 * pad));
    const yNombre = yDatos - 20 - altoNombre;
    vidrio(ctx, borroso, xCard, yNombre, w, altoNombre);
    if (logo) ctx.drawImage(logo, xCard + pad, yNombre + (altoNombre - hLogo) / 2, anchoLogo, hLogo);
    ctx.fillStyle = "#fff";
    for (const [i, l] of lineas.entries()) {
      const y = yNombre + altoNombre / 2 + (i - (lineas.length - 1) / 2) * interlinea + 3;
      ctx.fillText(recortar(ctx, l, maxTexto), xTexto, y);
    }
    let x: number;

    // Tarjeta de abajo: íconos en blanco, salvo la bandera (color vigente; gris si no hay).
    vidrio(ctx, borroso, xCard, yDatos, w, altoDatos);
    type Dato = { dibujar: (x: number, y: number) => void; texto: string };
    const tamIcono = horizontal ? 40 : 44;
    const relleno = (trazo: string, color: string) => (x: number, y: number) => {
      ctx.save();
      ctx.translate(x, y - tamIcono / 2);
      ctx.scale(tamIcono / 24, tamIcono / 24);
      ctx.fillStyle = color;
      ctx.fill(new Path2D(trazo));
      ctx.restore();
    };
    const datos: Dato[] = [
      ...(sello.aire != null
        ? [{ texto: `${sello.aire}°`, dibujar: (x: number, y: number) => sello.cielo && icono(ctx, ICONO_CIELO[sello.cielo], "#fff", x, y, tamIcono) }]
        : []),
      ...(sello.viento ? [{ texto: sello.viento, dibujar: (x: number, y: number) => icono(ctx, ICONO_VIENTO, "#fff", x, y, tamIcono) }] : []),
      {
        texto: "",
        dibujar: (x: number, y: number) => {
          relleno(PANO, sello.bandera)(x, y);
          icono(ctx, [PANO, MASTIL], "#fff", x, y, tamIcono);
        },
      },
      ...(sello.meGusta != null ? [{ texto: numero.format(sello.meGusta), dibujar: relleno(CORAZON, "#fff") }] : []),
    ];
    // Por fila: fuente que entre en el ancho y el espacio sobrante repartido entre los datos.
    const anchoDe = (d: Dato) => tamIcono + (d.texto ? 14 + ctx.measureText(d.texto).width : 0);
    const filas = Array.from({ length: Math.ceil(datos.length / porFila) }, (_, i) => datos.slice(i * porFila, (i + 1) * porFila));
    const suma = (f: Dato[]) => f.reduce((t, d) => t + anchoDe(d), 0) + 32 * (f.length - 1);
    let tam = horizontal ? 36 : 40;
    do ctx.font = `600 ${tam}px ${familia}`;
    while (Math.max(...filas.map(suma)) > w - 2 * pad && (tam -= 2) > 24);
    for (const [i, fila] of filas.entries()) {
      const libre = w - 2 * pad - fila.reduce((t, d) => t + anchoDe(d), 0);
      const hueco = fila.length > 1 ? libre / (fila.length - 1) : 0;
      const yCentro = filas.length === 1 ? yDatos + altoDatos / 2 : yDatos + 12 + 42 + i * 84;
      x = xCard + pad;
      for (const d of fila) {
        d.dibujar(x, yCentro);
        if (d.texto) {
          ctx.fillStyle = "#fff";
          ctx.fillText(d.texto, x + tamIcono + 14, yCentro + 2);
        }
        x += anchoDe(d) + hueco;
      }
    }

    return await new Promise<Blob>((ok, mal) =>
      canvas.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo crear la imagen"))), "image/jpeg", 0.9),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
