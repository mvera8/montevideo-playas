import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Matrix4,
  PlaneGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Casilla de guardavidas de Montevideo (modelo low-poly, unidades = metros, Y arriba,
// frente hacia +Z que en el mapa es el sur → mirando al Río de la Plata).
// Todas las piezas se fusionan en UNA geometría con colores por vértice, así todas
// las casillas del mapa se dibujan en un único draw call con InstancedMesh.

const AMARILLO = "#f7e39a";
const AMARILLO_OSCURO = "#ecd27f";
const TOLDO = "#faeec0";
const TECHO = "#e9e2d0";
const METAL = "#9aa1a8";
const VIDRIO = "#3c4a55";
const MADERA = "#d8bf94";
const MASTIL = "#e8e8e8";
const ROJO = "#d93a2b";

export const ALTURA_MODELO = 8; // m, incluyendo el mástil
export const MASTIL_POS = { x: 2.6, y: 7.6, z: 1.7 }; // punto de anclaje de la bandera

type Pieza = { geo: BufferGeometry; color: string };

function caja(
  w: number,
  h: number,
  d: number,
  color: string,
  pos: [number, number, number],
  rot?: { x?: number; y?: number; z?: number },
): Pieza {
  const geo = new BoxGeometry(w, h, d);
  const m = new Matrix4();
  if (rot?.x) m.multiply(new Matrix4().makeRotationX(rot.x));
  if (rot?.y) m.premultiply(new Matrix4().makeRotationY(rot.y));
  if (rot?.z) m.premultiply(new Matrix4().makeRotationZ(rot.z));
  m.premultiply(new Matrix4().makeTranslation(...pos));
  geo.applyMatrix4(m);
  return { geo, color };
}

// Panel que rota sobre su borde superior (toldos abatibles).
function toldo(w: number, d: number, pos: [number, number, number], rotX: number, rotY = 0): Pieza {
  const geo = new BoxGeometry(w, 0.05, d);
  geo.translate(0, 0, d / 2); // bisagra en el borde
  geo.applyMatrix4(new Matrix4().makeRotationX(rotX));
  geo.applyMatrix4(new Matrix4().makeRotationY(rotY));
  geo.translate(...pos);
  return { geo, color: TOLDO };
}

function fusionar(piezas: Pieza[]) {
  const geos = piezas.map(({ geo, color }) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.deleteAttribute("uv");
    const c = new Color(color).convertSRGBToLinear();
    const n = g.getAttribute("position").count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new BufferAttribute(colors, 3));
    return g;
  });
  const merged = mergeGeometries(geos)!;
  geos.forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}

export function crearGeometriaCasilla(): BufferGeometry {
  const P: Pieza[] = [];
  const hPiso = 2.2;

  // Zancos y cruces de San Andrés.
  for (const x of [-1.5, 1.5])
    for (const z of [-1.5, 1.5]) P.push(caja(0.14, hPiso, 0.14, METAL, [x, hPiso / 2, z]));
  const diag = Math.hypot(3, hPiso);
  const ang = Math.atan2(hPiso, 3);
  for (const z of [-1.5, 1.5])
    for (const s of [1, -1]) P.push(caja(diag, 0.08, 0.08, METAL, [0, hPiso / 2, z], { z: s * ang }));
  for (const x of [-1.5, 1.5])
    for (const s of [1, -1])
      P.push(caja(0.08, 0.08, diag, METAL, [x, hPiso / 2, 0], { x: s * ang }));

  // Plataforma (se extiende hacia el frente como deck).
  P.push(caja(4.2, 0.18, 4.2, METAL, [0, hPiso, 0.3]));

  // Cuerpo de la cabina.
  const yCab = hPiso + 0.09;
  P.push(caja(3, 1.2, 2.6, AMARILLO, [0, yCab + 0.6, -0.5])); // zócalo
  P.push(caja(3, 0.35, 2.6, AMARILLO, [0, yCab + 2.35, -0.5])); // dintel
  P.push(caja(0.12, 1.0, 2.6, AMARILLO_OSCURO, [-1.44, yCab + 1.7, -0.5])); // pilares
  P.push(caja(0.12, 1.0, 2.6, AMARILLO_OSCURO, [1.44, yCab + 1.7, -0.5]));
  P.push(caja(3, 1.0, 0.12, AMARILLO, [0, yCab + 1.7, -1.74])); // fondo
  // Vidrios (frente y laterales).
  P.push(caja(2.8, 0.95, 0.04, VIDRIO, [0, yCab + 1.7, 0.78]));
  P.push(caja(0.04, 0.95, 2.4, VIDRIO, [-1.5, yCab + 1.7, -0.5]));
  P.push(caja(0.04, 0.95, 2.4, VIDRIO, [1.5, yCab + 1.7, -0.5]));
  // Guardavida (remera roja) adentro.
  P.push(caja(0.45, 0.6, 0.3, ROJO, [-0.3, yCab + 1.5, 0.2]));

  // Techo con alero.
  const yTecho = yCab + 2.6;
  P.push(caja(3.4, 0.14, 3.0, TECHO, [0, yTecho, -0.45]));
  P.push(caja(3.0, 0.3, 2.2, AMARILLO_OSCURO, [0, yTecho + 0.2, -0.5]));

  // Toldos abiertos hacia afuera (frente y laterales).
  P.push(toldo(3.0, 1.1, [0, yTecho - 0.12, 0.8], -0.55));
  P.push(toldo(2.4, 0.9, [1.5, yTecho - 0.12, -0.5], -0.55, Math.PI / 2));
  P.push(toldo(2.4, 0.9, [-1.5, yTecho - 0.12, -0.5], -0.55, -Math.PI / 2));

  // Baranda del deck.
  const yB = hPiso + 1.0;
  P.push(caja(4.2, 0.07, 0.07, METAL, [0, yB, 2.35]));
  P.push(caja(4.2, 0.07, 0.07, METAL, [0, yB - 0.45, 2.35]));
  for (const x of [-2.05, 2.05]) {
    P.push(caja(0.07, 0.07, 1.6, METAL, [x, yB, 1.6]));
    P.push(caja(0.07, 0.07, 1.6, METAL, [x, yB - 0.45, 1.6]));
  }
  for (const x of [-2.05, -0.7, 0.7, 2.05]) P.push(caja(0.08, 1.0, 0.08, METAL, [x, hPiso + 0.5, 2.35]));
  for (const x of [-2.05, 2.05]) P.push(caja(0.08, 1.0, 0.08, METAL, [x, hPiso + 0.5, 0.85]));

  // Rampa de madera desde el costado hasta la arena.
  const largo = 4.2;
  const pend = Math.asin(hPiso / largo);
  P.push(
    caja(largo, 0.1, 1.0, MADERA, [-2.1 - (Math.cos(pend) * largo) / 2, hPiso / 2, 1.6], {
      z: pend,
    }),
  );

  // Mástil de la bandera.
  const mastil = new CylinderGeometry(0.05, 0.07, MASTIL_POS.y + 0.2, 6, 1);
  mastil.translate(MASTIL_POS.x, (MASTIL_POS.y + 0.2) / 2, MASTIL_POS.z);
  P.push({ geo: mastil, color: MASTIL });

  return fusionar(P);
}

// Algo más grande que la real para que el color se lea a distancia.
export const BANDERA = { ancho: 2.6, alto: 1.7 };

// La bandera parte del mástil (x=0) hacia +X; su borde superior en y=0.
export function crearGeometriaBandera(): BufferGeometry {
  const g = new PlaneGeometry(BANDERA.ancho, BANDERA.alto, 14, 4);
  g.translate(BANDERA.ancho / 2, -BANDERA.alto / 2, 0);
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  return g;
}
