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
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from "three";
import { MercatorCoordinate, type CustomLayerInterface, type Map as MapLibreMap } from "maplibre-gl";
import {
  ALTURA_MODELO,
  BANDERA,
  MASTIL_POS,
  crearGeometriaBandera,
  crearGeometriaCasilla,
} from "./modelo";

export type CasillaMapa = {
  id: string;
  lng: number;
  lat: number;
  bandera: "green" | "yellow" | "red" | "black" | null;
  vientoDeg: number | null; // de dónde sopla (0 = norte)
  vientoKmh: number | null;
};

const COLORES: Record<NonNullable<CasillaMapa["bandera"]> | "none", string> = {
  green: "#1f9d4c",
  yellow: "#f5c518",
  red: "#d62828",
  black: "#1b1b1b",
  none: "#c9ced4", // fuera de temporada / sin datos
};

const FRAME_MS = 1000 / 30; // la bandera se anima a 30 fps para no recargar la GPU
const ZOOM_ANIMACION = 13; // más lejos la bandera es muy chica: el mapa queda quieto

// Una sola escena Three.js compartiendo el contexto WebGL de MapLibre.
// Casillas y banderas son InstancedMesh → 2 draw calls para todas las playas.
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
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        uniform float uTime;
        attribute float aViento;
        attribute vec3 aColor;
        varying vec3 vColor;
        varying float vShade;
        void main() {
          vec3 p = position;
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
        varying vec3 vColor;
        varying float vShade;
        void main() {
          gl_FragColor = vec4(vColor * vShade, 1.0);
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
    this.renderer?.dispose();
  }

  setCasillas(casillas: CasillaMapa[]) {
    this.casillas = casillas;
    if (this.renderer) this.construirMeshes();
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
    this.banderaMat!.uniforms.uTime.value = this.animar ? performance.now() / 1000 : 0;

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
    for (const m of [this.casillasMesh, this.banderasMesh]) {
      if (!m) continue;
      this.scene.remove(m);
      m.geometry.dispose();
      m.dispose();
    }
    (this.casillasMesh?.material as MeshLambertMaterial | undefined)?.dispose();
    this.casillasMesh = this.banderasMesh = undefined;
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
    const geoBandera = crearGeometriaBandera();
    const viento = new Float32Array(n);
    this.casillas.forEach((c, i) => {
      viento[i] = Math.min(Math.max(((c.vientoKmh ?? 15) - 5) / 35, 0), 1);
    });
    const colores = new Float32Array(n * 3);
    const color = new Color();
    this.casillas.forEach((c, i) => {
      color.set(COLORES[c.bandera ?? "none"]).toArray(colores, i * 3); // lineal
    });
    geoBandera.setAttribute("aViento", new InstancedBufferAttribute(viento, 1));
    geoBandera.setAttribute("aColor", new InstancedBufferAttribute(colores, 3));
    this.banderasMesh = new InstancedMesh(geoBandera, this.banderaMat!, n);

    for (const m of [this.casillasMesh, this.banderasMesh]) {
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
    const mastil = new Matrix4().makeTranslation(MASTIL_POS.x, MASTIL_POS.y, MASTIL_POS.z);
    const rot = new Matrix4();

    this.casillas.forEach((c, i) => {
      const m = MercatorCoordinate.fromLngLat([c.lng, c.lat], 0);
      const x = (m.x - this.origen.x) / this.escalaMerc;
      const z = (m.y - this.origen.y) / this.escalaMerc;
      const s = escalaBase * (c.id === this.seleccion ? 1.4 : 1);
      base.makeScale(s, s, s).setPosition(x, 0, z);
      this.casillasMesh!.setMatrixAt(i, base);

      // La bandera apunta hacia donde va el viento (rumbo = origen + 180°).
      const rumbo = (((c.vientoDeg ?? 135) + 180) * Math.PI) / 180;
      rot.makeRotationY(Math.PI / 2 - rumbo);
      bandera.copy(base).multiply(mastil).multiply(rot);
      this.banderasMesh!.setMatrixAt(i, bandera);
    });
    this.casillasMesh!.instanceMatrix.needsUpdate = true;
    this.banderasMesh!.instanceMatrix.needsUpdate = true;
  }
}
