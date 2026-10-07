// Genera los íconos del manifest (public/icons/) y src/app/apple-icon.png a partir del logo completo
// (public/logo.svg), sobre fondo oscuro. Correr de nuevo si cambia el logo: `node scripts/generar-iconos.mjs`.
// Solo el favicon (src/app/icon.svg) usa el logo recortado; todo lo demás va con los rayos enteros.
// Usa sharp, que ya viene con Next.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const LOGO = "public/logo.svg";

// `escala`: cuánto del lado ocupa el logo. Los maskable dejan margen porque Android los recorta
// (círculo, gota, etc.): la zona segura es el 80% central.
const ICONOS = [
  { archivo: "public/icons/icon-192.png", lado: 192, escala: 0.7 },
  { archivo: "public/icons/icon-512.png", lado: 512, escala: 0.7 },
  { archivo: "public/icons/icon-maskable-512.png", lado: 512, escala: 0.56 },
  { archivo: "src/app/apple-icon.png", lado: 180, escala: 0.74 },
];

const fondo = (lado) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#1e1e20"/><stop offset="1" stop-color="#0f0f10"/>
      </linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
    </svg>`,
  );

await mkdir("public/icons", { recursive: true });
for (const { archivo, lado, escala } of ICONOS) {
  const tam = Math.round(lado * escala);
  const logo = await sharp(LOGO, { density: 300 }).resize(tam, tam, { fit: "contain", background: "#0000" }).png().toBuffer();
  await sharp(fondo(lado))
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(archivo);
  console.log(archivo);
}
