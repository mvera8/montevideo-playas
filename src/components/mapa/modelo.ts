import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Matrix4,
  PlaneGeometry,
  SphereGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Casilla de guardavidas de Montevideo (modelo low-poly, unidades = metros, Y arriba).
// El frente (vidrios, toldo y rampa) mira hacia +Z; la capa rota cada casilla para que
// ese frente apunte al agua según la orientación de su playa.
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

  // Baranda del deck, con una abertura al frente-izquierda para la rampa (x de -2.05 a -0.7).
  const yB = hPiso + 1.0;
  const frente = 2.35;
  for (const y of [yB, yB - 0.45]) P.push(caja(2.75, 0.07, 0.07, METAL, [0.675, y, frente]));
  for (const x of [-2.05, 2.05]) {
    P.push(caja(0.07, 0.07, 1.6, METAL, [x, yB, 1.6]));
    P.push(caja(0.07, 0.07, 1.6, METAL, [x, yB - 0.45, 1.6]));
  }
  for (const x of [-2.05, -0.7, 0.7, 2.05]) P.push(caja(0.08, 1.0, 0.08, METAL, [x, hPiso + 0.5, frente]));
  for (const x of [-2.05, 2.05]) P.push(caja(0.08, 1.0, 0.08, METAL, [x, hPiso + 0.5, 0.85]));

  // Rampa de madera: baja desde el frente del deck hacia +Z, o sea hacia el agua
  // (la capa gira cada casilla para que su frente mire al río).
  const largo = 4.2;
  const pend = Math.asin(hPiso / largo);
  const xRampa = -1.375; // centrada en la abertura de la baranda
  P.push(caja(1.0, 0.1, largo, MADERA, [xRampa, hPiso / 2, frente + (Math.cos(pend) * largo) / 2], { x: pend }));
  // Pasamanos de la rampa.
  for (const dx of [-0.5, 0.5])
    P.push(
      caja(0.05, 0.05, largo, METAL, [xRampa + dx, hPiso / 2 + 0.9, frente + (Math.cos(pend) * largo) / 2], { x: pend }),
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

// Agua viva flotando frente a la playa (aguas vivas reportadas cerca). Unidades = metros, Y arriba.
// Campana (media esfera achatada) + tentáculos finos en el borde + brazos orales al centro. Todo en una
// geometría con `aParte` (0 = campana, 1 = tentáculo/brazo) y `aLargo` (0 en la raíz → 1 en la punta)
// para que el vertex shader haga el latido y la ondulación sin trabajo en CPU.
export const AGUA_VIVA = { radio: 1.9, yBorde: 4.4, largoTentaculo: 3.4 };

export function crearGeometriaAguaViva(): BufferGeometry {
  const { radio, yBorde, largoTentaculo } = AGUA_VIVA;
  const partes: BufferGeometry[] = [];
  const marcar = (g: BufferGeometry, parte: number, raizY: number, largo: number) => {
    const pos = g.getAttribute("position");
    const aParte = new Float32Array(pos.count).fill(parte);
    const aLargo = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) aLargo[i] = largo ? Math.min(Math.max((raizY - pos.getY(i)) / largo, 0), 1) : 0;
    g.deleteAttribute("uv");
    g.setAttribute("aParte", new BufferAttribute(aParte, 1));
    g.setAttribute("aLargo", new BufferAttribute(aLargo, 1));
    partes.push(g.index ? g.toNonIndexed() : g);
  };

  // Campana: media esfera achatada, abierta hacia abajo.
  const campana = new SphereGeometry(radio, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  campana.scale(1, 0.72, 1);
  campana.translate(0, yBorde, 0);
  marcar(campana, 0, yBorde, 0);

  // Tentáculos finos alrededor del borde, de largos distintos.
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const largo = largoTentaculo * (0.75 + 0.25 * ((i * 7) % 3) / 2);
    const t = new BoxGeometry(0.18, largo, 0.18, 1, 8, 1);
    t.translate(Math.cos(a) * radio * 0.9, yBorde - largo / 2, Math.sin(a) * radio * 0.9);
    marcar(t, 1, yBorde, largoTentaculo);
  }
  // Brazos orales: cintas anchas al centro, más cortas.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI + 0.4;
    const largo = largoTentaculo * 0.7;
    const b = new PlaneGeometry(0.7, largo, 1, 8);
    b.rotateY(a);
    b.translate(Math.cos(a) * 0.25, yBorde - largo / 2, Math.sin(a) * 0.25);
    marcar(b, 1, yBorde, largoTentaculo);
  }

  const merged = mergeGeometries(partes)!;
  partes.forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}
