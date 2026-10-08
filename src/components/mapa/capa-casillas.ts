import {
  Camera,
  Color,
  DirectionalLight,
  DoubleSide,
  HemisphereLight,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  NormalBlending,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from "three";
import { MercatorCoordinate, type CustomLayerInterface, type Map as MapLibreMap } from "maplibre-gl";
import {
  AGUA_VIVA,
  ALTURA_MODELO,
  BANDERA,
  MASTIL_POS,
  crearGeometriaAguaViva,
  crearGeometriaBandera,
  crearGeometriaCasilla,
} from "./modelo";
import { SANITARIA } from "./BanderaSanitaria";

export type CasillaMapa = {
  id: string;
  lng: number;
  lat: number;
  bandera: "green" | "yellow" | "red" | "black" | null;
  sanitaria: boolean; // bandera sanitaria activa (roja con cruz verde)
  vientoDeg: number | null; // de dónde sopla (0 = norte)
  vientoKmh: number | null;
  orientacion: number; // rumbo hacia el agua (0 = norte, 180 = sur): hacia ahí mira el frente
};

// Agua viva flotando frente a una playa con reportes recientes cerca (ver lib/aguas-vivas.ts).
export type AguaVivaMapa = {
  slug: string;
  lng: number;
  lat: number;
  orientacion: number; // rumbo hacia el agua: el agua viva se dibuja hacia ese lado de la playa
  peligrosa: boolean; // fragata portuguesa u Olindias: en rojo
};

const COLOR_AGUA_VIVA = { normal: "#8f6bff", peligrosa: "#f0364f" };
// Distancia al agua desde el centro de la playa, en "metros del modelo" (escala con el zoom igual que la
// casilla). De cerca se duplica: con la casilla a tamaño real y el mapa inclinado quedaría encima de la
// casilla del medio.
const SEPARACION_AGUA_VIVA = 11;
const ESCALA_AGUA_VIVA = 0.95; // como la casilla: se lee bien y no compite con ella
// Al tocarla se abre la playa en la sección "Aguas vivas" (aguaVivaEn + Mapa.tsx).

const COLORES: Record<NonNullable<CasillaMapa["bandera"]> | "none", string> = {
  green: "#1f9d4c",
  yellow: "#f5c518",
  red: "#d62828",
  black: "#1b1b1b",
  none: "#c9ced4", // fuera de temporada / sin datos
};
const SEPARACION_BANDERAS = BANDERA.alto + 0.3; // la sanitaria va debajo de la de seguridad, en el mismo mástil

// Banderas de una casilla, de arriba hacia abajo. Sin bandera de seguridad (fuera de temporada) la
// sanitaria ocupa su lugar en vez del paño gris.
function banderasDe(c: CasillaMapa): { color: string; cruz: boolean }[] {
  const sanitaria = { color: SANITARIA.fondo, cruz: true };
  if (!c.bandera) return [c.sanitaria ? sanitaria : { color: COLORES.none, cruz: false }];
  return c.sanitaria ? [{ color: COLORES[c.bandera], cruz: false }, sanitaria] : [{ color: COLORES[c.bandera], cruz: false }];
}

const FRAME_MS = 1000 / 30; // la bandera se anima a 30 fps para no recargar la GPU
const ZOOM_ANIMACION = 13; // más lejos la bandera es muy chica: el mapa queda quieto

// Una sola escena Three.js compartiendo el contexto WebGL de MapLibre.
// Casillas, banderas y aguas vivas son InstancedMesh → 3 draw calls para todas las playas. Una casilla puede tener
// dos banderas (seguridad arriba, sanitaria abajo): cada bandera es una instancia.
// El flameo de la bandera se calcula en el vertex shader (cero trabajo en CPU por frame).
export class CapaCasillas implements CustomLayerInterface {
  readonly id = "casillas-3d";
  readonly type = "custom" as const;
  readonly renderingMode = "3d" as const;

  private map?: MapLibreMap;
  private renderer?: WebGLRenderer;
  private scene = new Scene();
  private camera = new Camera();
  private casillasMesh?: InstancedMesh;
  private banderasMesh?: InstancedMesh;
  private banderaMat?: ShaderMaterial;
  private aguasVivasMesh?: InstancedMesh;
  private aguaVivaMat?: ShaderMaterial;
  private aguasVivas: AguaVivaMapa[] = [];
  // Dónde quedó cada agua viva en el último cuadro (se corre con el zoom) y su alto en pantalla, para
  // saber si un toque cayó sobre ella (ver aguaVivaEn).
  private aguasVivasEnMapa: { slug: string; lngLat: [number, number] }[] = [];
  private altoAguaVivaPx = 0;
  private origen: MercatorCoordinate;
  private escalaMerc: number;
  private local: Matrix4;
  private casillas: CasillaMapa[] = [];
  private seleccion: string | null = null;
  private zoomAplicado = -1;
  private timer = 0;
  private animar = true;
  private cielo = new HemisphereLight("#ffffff", "#efe4c8", 2.8);
  private sol = new DirectionalLight("#fffaf0", 1.3);

  constructor(centro: [number, number]) {
    this.origen = MercatorCoordinate.fromLngLat(centro, 0);
    this.escalaMerc = this.origen.meterInMercatorCoordinateUnits();
    const s = this.escalaMerc;
    // Metros locales (Y arriba, +Z = sur) → coordenadas mercator del mapa.
    this.local = new Matrix4()
      .makeTranslation(this.origen.x, this.origen.y, this.origen.z)
      .scale(new Vector3(s, -s, s))
      .multiply(new Matrix4().makeRotationX(Math.PI / 2));
  }

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map;
    this.animar = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.renderer = new WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;

    // Luz "de catálogo": ilumina el frente (que mira al río) para que se lea el amarillo.
    this.sol.position.set(0.5, 1, 1.2);
    this.scene.add(this.cielo, this.sol);

    this.banderaMat = new ShaderMaterial({
      side: DoubleSide,
      uniforms: { uTime: { value: 0 }, uCruz: { value: new Color(SANITARIA.cruz) } },
      vertexShader: /* glsl */ `
        uniform float uTime;
        attribute float aViento;
        attribute vec3 aColor;
        attribute float aCruz;
        varying vec3 vColor;
        varying float vShade;
        varying vec2 vPos;
        varying float vCruz;
        void main() {
          vec3 p = position;
          vPos = p.xy;
          vCruz = aCruz;
          float u = p.x / ${BANDERA.ancho.toFixed(2)};
          float fase = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
          float amp = mix(0.06, 0.32, aViento);
          float w = uTime * mix(2.5, 7.0, aViento) + fase;
          float k = 3.4;
          float a = p.x * k - w;
          float ola = sin(a) + 0.35 * sin(a * 2.1 + p.y * 1.7);
          p.z += amp * u * ola;
          p.y -= mix(0.35, 0.05, aViento) * u * u; // con poco viento la bandera cae
          float pend = amp * u * k * cos(a);
          vShade = 0.68 + 0.32 * clamp(0.55 - pend * 0.7, 0.0, 1.0);
          vColor = aColor;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCruz;
        varying vec3 vColor;
        varying float vShade;
        varying vec2 vPos;
        varying float vCruz;
        void main() {
          // Cruz centrada en el paño (metros, sin deformar por el flameo).
          vec2 q = abs(vPos - vec2(${(BANDERA.ancho / 2).toFixed(2)}, ${(-BANDERA.alto / 2).toFixed(2)}));
          float cruz = vCruz * float((q.x < 0.17 && q.y < 0.6) || (q.y < 0.17 && q.x < 0.6));
          gl_FragColor = vec4(mix(vColor, uCruz, cruz) * vShade, 1.0);
          #include <colorspace_fragment>
        }`,
    });

    // Latido de la campana, tentáculos que ondulan con retardo y un sube y baja, todo en el vertex
    // shader. Semitransparente, con el borde más claro (efecto gelatina) y brillo propio de noche.
    this.aguaVivaMat = new ShaderMaterial({
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      uniforms: { uTime: { value: 0 }, uNoche: { value: 0 } },
      vertexShader: /* glsl */ `
        uniform float uTime;
        attribute float aParte;
        attribute float aLargo;
        attribute vec3 aColor;
        varying vec3 vColor;
        varying float vParte;
        varying float vLuz;
        varying float vLargo;
        void main() {
          vec3 p = position;
          float fase = instanceMatrix[3].x * 0.41 + instanceMatrix[3].z * 0.29;
          float t = uTime * 2.4 + fase;
          // Contracción rápida y relajación lenta, como una medusa real.
          float c = pow(0.5 + 0.5 * sin(t), 2.0);
          float yBorde = ${AGUA_VIVA.yBorde.toFixed(2)};
          if (aParte < 0.5) {
            float h = clamp((p.y - yBorde) / ${(AGUA_VIVA.radio * 0.72).toFixed(2)}, 0.0, 1.0);
            float apriete = 0.22 * c * (1.0 - h * 0.6); // el borde se cierra más que la cúpula
            p.xz *= 1.0 - apriete;
            p.y = yBorde + (p.y - yBorde) * (1.0 + 0.18 * c);
          } else {
            // Los tentáculos siguen el latido con retardo: más cuanto más lejos de la raíz.
            float d = aLargo;
            float lag = t - d * 2.6;
            p.xz *= 1.0 - 0.16 * pow(0.5 + 0.5 * sin(lag), 2.0) * (1.0 - d * 0.5);
            p.x += sin(lag * 0.9 + p.z * 1.3) * 0.35 * d;
            p.z += cos(lag * 0.8 + p.x * 1.1) * 0.35 * d;
            p.y += 0.25 * d * c; // al contraerse los tentáculos se recogen un poco
          }
          p.y += 0.55 * sin(t - 1.2); // sube al empujar y baja al relajarse
          vLuz = aParte < 0.5 ? 0.55 + 0.45 * normal.y : 0.85;
          vColor = aColor;
          vParte = aParte;
          vLargo = aLargo;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uNoche;
        varying vec3 vColor;
        varying float vParte;
        varying float vLuz;
        varying float vLargo;
        void main() {
          vec3 col = mix(vColor * vLuz, vec3(1.0), vParte * 0.15);
          col += vColor * uNoche * 0.6; // bioluminiscencia de noche
          float alfa = vParte < 0.5 ? 0.85 : 0.9 * (1.0 - vLargo * 0.5);
          gl_FragColor = vec4(col, alfa);
          #include <colorspace_fragment>
        }`,
    });

    this.construirMeshes();
    document.addEventListener("visibilitychange", this.alCambiarVisibilidad);
  }

  onRemove() {
    document.removeEventListener("visibilitychange", this.alCambiarVisibilidad);
    window.clearTimeout(this.timer);
    this.liberarMeshes();
    this.banderaMat?.dispose();
    this.aguaVivaMat?.dispose();
    this.renderer?.dispose();
  }

  setCasillas(casillas: CasillaMapa[]) {
    this.casillas = casillas;
    if (this.renderer) this.construirMeshes();
  }

  /** Se aplica en el próximo setCasillas (salen de los mismos datos: así se reconstruye una sola vez). */
  setAguasVivas(aguasVivas: AguaVivaMapa[]) {
    this.aguasVivas = aguasVivas;
  }

  /** Slug de la playa cuya agua viva está bajo el punto de pantalla (px del canvas), o null. */
  aguaVivaEn(punto: { x: number; y: number }): string | null {
    if (!this.map || !this.altoAguaVivaPx) return null;
    const alto = this.altoAguaVivaPx;
    const radio = Math.max(alto * 0.4, 14); // dedo: al menos ~28 px de ancho
    for (const a of this.aguasVivasEnMapa) {
      const p = this.map.project(a.lngLat); // pie del agua viva (en el agua)
      if (Math.abs(punto.x - p.x) <= radio && punto.y <= p.y + radio / 2 && punto.y >= p.y - alto) return a.slug;
    }
    return null;
  }

  /** Luz según el tema: sol de catálogo, nublado difuso o noche cálida (rambla iluminada). */
  setLuz(luz: "soleado" | "nublado" | "lluvia" | "noche") {
    const L = {
      soleado: { cielo: "#ffffff", suelo: "#efe4c8", ci: 2.8, sol: "#fffaf0", si: 1.3 },
      nublado: { cielo: "#e6ebf0", suelo: "#d9d6cf", ci: 2.6, sol: "#ffffff", si: 0.5 },
      lluvia: { cielo: "#cdd7e2", suelo: "#a9b2bb", ci: 2.1, sol: "#e8eef5", si: 0.3 },
      noche: { cielo: "#8fa3d9", suelo: "#3a2a10", ci: 0.9, sol: "#ffc56e", si: 0.9 },
    }[luz];
    this.cielo.color.set(L.cielo);
    this.cielo.groundColor.set(L.suelo);
    this.cielo.intensity = L.ci;
    this.sol.color.set(L.sol);
    this.sol.intensity = L.si;
    if (this.aguaVivaMat) this.aguaVivaMat.uniforms.uNoche.value = luz === "noche" ? 1 : 0;
    this.map?.triggerRepaint();
  }

  setSeleccion(id: string | null) {
    if (id === this.seleccion) return;
    this.seleccion = id;
    this.zoomAplicado = -1;
    this.map?.triggerRepaint();
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: { defaultProjectionData: { mainMatrix: ArrayLike<number> } }) {
    if (!this.renderer || !this.map || !this.casillasMesh) return;

    const zoom = this.map.getZoom();
    if (Math.abs(zoom - this.zoomAplicado) > 0.01) this.actualizarMatrices(zoom);

    this.camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(this.local);
    const t = this.animar ? performance.now() / 1000 : 0;
    this.banderaMat!.uniforms.uTime.value = t;
    this.aguaVivaMat!.uniforms.uTime.value = t;

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);

    if (this.animar && zoom >= ZOOM_ANIMACION && !this.timer && !document.hidden) {
      this.timer = window.setTimeout(() => {
        this.timer = 0;
        this.map?.triggerRepaint();
      }, FRAME_MS);
    }
  }

  private alCambiarVisibilidad = () => {
    if (!document.hidden) this.map?.triggerRepaint();
  };

  private liberarMeshes() {
    for (const m of [this.casillasMesh, this.banderasMesh, this.aguasVivasMesh]) {
      if (!m) continue;
      this.scene.remove(m);
      m.geometry.dispose();
      m.dispose();
    }
    (this.casillasMesh?.material as MeshLambertMaterial | undefined)?.dispose();
    this.casillasMesh = this.banderasMesh = this.aguasVivasMesh = undefined;
    this.aguasVivasEnMapa = [];
    this.altoAguaVivaPx = 0;
  }

  private construirMeshes() {
    this.liberarMeshes();
    const n = this.casillas.length;
    if (n === 0) return;

    this.casillasMesh = new InstancedMesh(
      crearGeometriaCasilla(),
      new MeshLambertMaterial({ vertexColors: true }),
      n,
    );
    // Mismo orden que en actualizarMatrices: por casilla, de arriba hacia abajo.
    const banderas = this.casillas.flatMap((c) =>
      banderasDe(c).map((b) => ({ ...b, viento: Math.min(Math.max(((c.vientoKmh ?? 15) - 5) / 35, 0), 1) })),
    );
    const nb = banderas.length;
    const geoBandera = crearGeometriaBandera();
    const viento = new Float32Array(nb);
    const colores = new Float32Array(nb * 3);
    const cruz = new Float32Array(nb);
    const color = new Color();
    banderas.forEach((b, i) => {
      viento[i] = b.viento;
      cruz[i] = b.cruz ? 1 : 0;
      color.set(b.color).toArray(colores, i * 3); // lineal
    });
    geoBandera.setAttribute("aViento", new InstancedBufferAttribute(viento, 1));
    geoBandera.setAttribute("aColor", new InstancedBufferAttribute(colores, 3));
    geoBandera.setAttribute("aCruz", new InstancedBufferAttribute(cruz, 1));
    this.banderasMesh = new InstancedMesh(geoBandera, this.banderaMat!, nb);

    const na = this.aguasVivas.length;
    if (na) {
      const geoAgua = crearGeometriaAguaViva();
      const coloresAgua = new Float32Array(na * 3);
      this.aguasVivas.forEach((a, i) =>
        color.set(a.peligrosa ? COLOR_AGUA_VIVA.peligrosa : COLOR_AGUA_VIVA.normal).toArray(coloresAgua, i * 3),
      );
      geoAgua.setAttribute("aColor", new InstancedBufferAttribute(coloresAgua, 3));
      this.aguasVivasMesh = new InstancedMesh(geoAgua, this.aguaVivaMat!, na);
      this.aguasVivasMesh.renderOrder = 1; // transparente: después de casillas y banderas
    }

    for (const m of [this.casillasMesh, this.banderasMesh, this.aguasVivasMesh]) {
      if (!m) continue;
      m.frustumCulled = false; // la cámara es la del mapa; son pocas instancias
      m.matrixAutoUpdate = false;
      this.scene.add(m);
    }
    this.zoomAplicado = -1;
    this.map?.triggerRepaint();
  }

  // Las casillas mantienen un tamaño en pantalla parecido a un ícono al alejarse,
  // y tamaño real (o mayor) al acercarse.
  private actualizarMatrices(zoom: number) {
    this.zoomAplicado = zoom;
    const lat = this.map!.getCenter().lat;
    const metrosPorPx = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
    const px = Math.min(Math.max(28 + (zoom - 11) * 10, 28), 72);
    const escalaBase = Math.max(1, (px * metrosPorPx) / ALTURA_MODELO);

    const base = new Matrix4();
    const bandera = new Matrix4();
    const mastil = new Matrix4();
    const rot = new Matrix4();
    const giro = new Matrix4();
    const giroInverso = new Matrix4();

    let j = 0; // índice de bandera
    this.casillas.forEach((c, i) => {
      const m = MercatorCoordinate.fromLngLat([c.lng, c.lat], 0);
      const x = (m.x - this.origen.x) / this.escalaMerc;
      const z = (m.y - this.origen.y) / this.escalaMerc;
      const s = escalaBase * (c.id === this.seleccion ? 1.4 : 1);
      // El frente del modelo (+Z) mira al sur (rumbo 180°); girar para que mire al agua.
      const angulo = ((180 - c.orientacion) * Math.PI) / 180;
      giro.makeRotationY(angulo);
      giroInverso.makeRotationY(-angulo);
      base.makeScale(s, s, s).premultiply(giro).setPosition(x, 0, z);
      this.casillasMesh!.setMatrixAt(i, base);

      // La bandera apunta hacia donde va el viento (rumbo = origen + 180°), independiente del giro
      // de la casilla: se deshace el giro antes de aplicar el del viento.
      const rumbo = (((c.vientoDeg ?? 135) + 180) * Math.PI) / 180;
      rot.makeRotationY(Math.PI / 2 - rumbo);
      banderasDe(c).forEach((_, nivel) => {
        mastil.makeTranslation(MASTIL_POS.x, MASTIL_POS.y - nivel * SEPARACION_BANDERAS, MASTIL_POS.z);
        bandera.copy(base).multiply(mastil).multiply(giroInverso).multiply(rot);
        this.banderasMesh!.setMatrixAt(j++, bandera);
      });
    });
    this.casillasMesh!.instanceMatrix.needsUpdate = true;
    this.banderasMesh!.instanceMatrix.needsUpdate = true;

    // Aguas vivas: corridas hacia el agua desde el centro de la playa, al mismo tamaño en pantalla que la casilla.
    if (this.aguasVivasMesh) {
      // Alto en pantalla sin contar la inclinación (de más: el área de toque queda generosa).
      this.altoAguaVivaPx = (ESCALA_AGUA_VIVA * escalaBase * ALTURA_MODELO) / metrosPorPx;
      this.aguasVivasEnMapa = [];
      this.aguasVivas.forEach((a, i) => {
        const m = MercatorCoordinate.fromLngLat([a.lng, a.lat], 0);
        const rumbo = (a.orientacion * Math.PI) / 180;
        const d = SEPARACION_AGUA_VIVA * escalaBase * (1 + Math.min(Math.max((zoom - 12) / 3, 0), 1));
        const e = ESCALA_AGUA_VIVA * escalaBase;
        const x = (m.x - this.origen.x) / this.escalaMerc + Math.sin(rumbo) * d;
        const z = (m.y - this.origen.y) / this.escalaMerc - Math.cos(rumbo) * d; // +Z = sur
        base.makeScale(e, e, e).setPosition(x, 0, z);
        this.aguasVivasMesh!.setMatrixAt(i, base);
        const ll = new MercatorCoordinate(this.origen.x + x * this.escalaMerc, this.origen.y + z * this.escalaMerc, 0).toLngLat();
        this.aguasVivasEnMapa.push({ slug: a.slug, lngLat: [ll.lng, ll.lat] });
      });
      this.aguasVivasMesh.instanceMatrix.needsUpdate = true;
    }
  }
}
