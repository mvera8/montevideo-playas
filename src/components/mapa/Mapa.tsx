"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import {
  GeolocateControl,
  Map as MapLibreMap,
  NavigationControl,
  type GeoJSONSource,
  type LngLatBoundsLike,
  type MapLayerMouseEvent,
  setWorkerUrl,
} from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Guardavidas, Playa, Temporada } from "@/lib/playas";
import type { Weather } from "@/lib/weather";
import type { Opcion, Punto } from "@/lib/transporte/planificador";
import { CapaCasillas, type CasillaMapa } from "./capa-casillas";
import ComoIr, { claveTramo, type LlegadasPorTramo, type TramoBus } from "./ComoIr";
import PanelGeneral, { estadoPlaya, type EstadoBandera } from "./PanelGeneral";
import Pronostico from "./Pronostico";

// Copiado por scripts/copiar-worker-maplibre.mjs (postinstall).
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const ESTILO = "https://tiles.openfreemap.org/styles/positron";
const CENTRO: [number, number] = [-56.17, -34.9];
const COLOR_RUTA = "#0b6bcb";
const VACIO = { type: "FeatureCollection" as const, features: [] };

type Props = {
  playas: Playa[];
  temporada: Temporada;
  fuente: "im" | "respaldo";
  error: string | null;
  climaCiudad: Weather | null;
};

const BANDERAS: Record<NonNullable<Guardavidas["bandera"]>, { label: string; color: string }> = {
  green: { label: "Verde · apto para bañarse", color: "#1f9d4c" },
  yellow: { label: "Amarilla · precaución", color: "#f5c518" },
  red: { label: "Roja · no bañarse", color: "#d62828" },
  black: { label: "Negra · sin guardavidas", color: "#1b1b1b" },
};

const fechaFmt = new Intl.DateTimeFormat("es-UY", {
  day: "numeric",
  month: "long",
  timeZone: "America/Montevideo",
});

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const grados = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n)}°`);

// Una casilla 3D por cada casilla de la IM; si la playa no tiene casillas
// informadas, se dibuja una en la ubicación de la playa.
function aCasillas(playas: Playa[]): (CasillaMapa & { slug: string; nombre: string })[] {
  return playas.flatMap((p) => {
    const viento = { vientoDeg: p.clima?.windDirection ?? null, vientoKmh: p.clima?.windSpeed ?? null };
    if (p.guardavidas.length === 0)
      return [{ id: `playa:${p.slug}`, slug: p.slug, nombre: p.nombre, lng: p.lon, lat: p.lat, bandera: null, ...viento }];
    return p.guardavidas.map((g) => ({
      id: g.id,
      slug: p.slug,
      nombre: g.nombre,
      lng: g.lon,
      lat: g.lat,
      bandera: g.bandera,
      ...viento,
    }));
  });
}

export default function Mapa({ playas, temporada, fuente, error, climaCiudad }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const capaRef = useRef<CapaCasillas | null>(null);
  const [listo, setListo] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<EstadoBandera | null>(null);

  // Panel lateral (hoja inferior en móvil) plegable; se recuerda por navegador.
  const [abierto, setAbierto] = useState(() => {
    try {
      return localStorage.getItem("panel") !== "0";
    } catch {
      return true;
    }
  });
  const abiertoRef = useRef(abierto);
  useEffect(() => {
    abiertoRef.current = abierto;
    try {
      localStorage.setItem("panel", abierto ? "1" : "0");
    } catch {}
  }, [abierto]);
  // El componente solo corre en el cliente (ssr: false), así que podemos leer la URL acá.
  const [slug, setSlug] = useState<string | null>(() => {
    const inicial = new URLSearchParams(window.location.search).get("playa");
    return inicial && playas.some((p) => p.slug === inicial) ? inicial : null;
  });
  const [casillaId, setCasillaId] = useState<string | null>(null);

  // Cómo ir: origen del usuario (GPS o tocando el mapa) y opción elegida.
  const [origen, setOrigen] = useState<Punto | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [ubicando, setUbicando] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);
  const [ruta, setRuta] = useState<{ opcion: Opcion | null; llegadas: LlegadasPorTramo }>({
    opcion: null,
    llegadas: {},
  });
  const eligiendoRef = useRef(false);
  useEffect(() => {
    eligiendoRef.current = eligiendo;
  }, [eligiendo]);
  const onOpcion = useCallback((opcion: Opcion | null, llegadas: LlegadasPorTramo) => {
    setRuta({ opcion, llegadas });
  }, []);

  const casillas = useMemo(() => aCasillas(playas), [playas]);
  const playa = playas.find((p) => p.slug === slug) ?? null;

  // Destino del "cómo ir": la casilla elegida o, si no hay, el centro de la playa.
  const destino = useMemo<Punto | null>(() => {
    const c = casillas.find((x) => x.id === casillaId);
    if (c) return { lat: c.lat, lon: c.lng };
    return playa ? { lat: playa.lat, lon: playa.lon } : null;
  }, [casillas, casillaId, playa]);

  const resultados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return playas.filter(
      (p) =>
        (!filtro || estadoPlaya(p) === filtro) &&
        (!q ||
          normalizar(p.nombre).includes(q) ||
          p.guardavidas.some((g) => normalizar(g.nombre).includes(q))),
    );
  }, [busqueda, filtro, playas]);

  // Inicializa el mapa una sola vez.
  useEffect(() => {
    if (!contenedor.current) return;
    const lons = playas.map((p) => p.lon);
    const lats = playas.map((p) => p.lat);
    const bounds: LngLatBoundsLike = lons.length
      ? [
          [Math.min(...lons) - 0.01, Math.min(...lats) - 0.02],
          [Math.max(...lons) + 0.01, Math.max(...lats) + 0.01],
        ]
      : [
          [-56.4, -34.95],
          [-56.0, -34.85],
        ];

    const map = new MapLibreMap({
      container: contenedor.current,
      style: ESTILO,
      bounds,
      fitBoundsOptions: { padding: padding(40, abiertoRef.current) },
      pitch: 50,
      maxPitch: 70,
      maxBounds: [
        [-56.7, -35.15],
        [-55.7, -34.6],
      ],
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(
      new GeolocateControl({ positionOptions: { enableHighAccuracy: true } }),
      "bottom-right",
    );

    const capa = new CapaCasillas(CENTRO);
    capaRef.current = capa;

    map.on("load", () => {
      map.addLayer(capa);

      map.addSource("casillas", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      // Área de click invisible, desplazada hacia arriba para cubrir la casilla en pantalla.
      map.addLayer({
        id: "casillas-hit",
        type: "circle",
        source: "casillas",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 12, 16, 30],
          "circle-opacity": 0,
          "circle-translate": [0, -18],
          "circle-translate-anchor": "viewport",
        },
      });
      map.addSource("playas", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "playas-nombres",
        type: "symbol",
        source: "playas",
        minzoom: 11.5,
        maxzoom: 15,
        layout: {
          "text-field": ["get", "nombre"],
          "text-font": ["Noto Sans Bold"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 12, 11, 15, 14],
          "text-anchor": "top",
          "text-offset": [0, 0.8],
        },
        paint: { "text-color": "#0f3a52", "text-halo-color": "#ffffff", "text-halo-width": 1.6 },
      });
      // De cerca, el nombre de cada casilla debajo de su base.
      map.addLayer({
        id: "casillas-nombres",
        type: "symbol",
        source: "casillas",
        minzoom: 15,
        layout: {
          "text-field": ["get", "nombre"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 12,
          "text-anchor": "top",
          "text-offset": [0, 1],
        },
        paint: { "text-color": "#0f3a52", "text-halo-color": "#ffffff", "text-halo-width": 1.6 },
      });

      // Recorrido del "cómo ir" (debajo de las casillas 3D) y ómnibus en vivo.
      map.addSource("ruta", { type: "geojson", data: VACIO });
      map.addSource("vivo", { type: "geojson", data: VACIO });
      map.addLayer(
        {
          id: "ruta-pie",
          type: "line",
          source: "ruta",
          filter: ["==", ["get", "tipo"], "pie"],
          layout: { "line-cap": "round" },
          paint: { "line-color": "#475569", "line-width": 3, "line-dasharray": [0.1, 2] },
        },
        capa.id,
      );
      map.addLayer(
        {
          id: "ruta-bus-borde",
          type: "line",
          source: "ruta",
          filter: ["==", ["get", "tipo"], "bus"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#ffffff", "line-width": 9 },
        },
        capa.id,
      );
      map.addLayer(
        {
          id: "ruta-bus",
          type: "line",
          source: "ruta",
          filter: ["==", ["get", "tipo"], "bus"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": COLOR_RUTA, "line-width": 5 },
        },
        capa.id,
      );
      map.addLayer({
        id: "ruta-puntos",
        type: "circle",
        source: "ruta",
        filter: ["in", ["get", "tipo"], ["literal", ["parada", "origen"]]],
        paint: {
          "circle-radius": ["match", ["get", "tipo"], "origen", 8, 6],
          "circle-color": ["match", ["get", "tipo"], "origen", "#2563eb", "#ffffff"],
          "circle-stroke-color": ["match", ["get", "tipo"], "origen", "#ffffff", COLOR_RUTA],
          "circle-stroke-width": 3,
        },
      });
      map.addLayer({
        id: "ruta-paradas-nombres",
        type: "symbol",
        source: "ruta",
        filter: ["==", ["get", "tipo"], "parada"],
        layout: {
          "text-field": ["get", "nombre"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 11,
          "text-anchor": "left",
          "text-offset": [0.9, 0],
          "text-max-width": 12,
        },
        paint: { "text-color": COLOR_RUTA, "text-halo-color": "#ffffff", "text-halo-width": 1.6 },
      });
      map.addLayer({
        id: "vivo",
        type: "circle",
        source: "vivo",
        paint: {
          "circle-radius": 11,
          "circle-color": "#059669",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "vivo-linea",
        type: "symbol",
        source: "vivo",
        layout: {
          "text-field": ["get", "linea"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 10,
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#ffffff" },
      });

      // En modo "elegir en el mapa", el próximo toque fija el origen.
      map.on("click", (e) => {
        if (!eligiendoRef.current) return;
        setOrigen({ lat: e.lngLat.lat, lon: e.lngLat.lng });
        setEligiendo(false);
      });

      map.on("click", "casillas-hit", (e: MapLayerMouseEvent) => {
        if (eligiendoRef.current) return;
        const f = e.features?.[0];
        if (!f) return;
        setSlug(f.properties.slug as string);
        setCasillaId(f.properties.id as string);
        // Tocar una casilla con el panel cerrado lo abre para ver el detalle.
        abiertoRef.current = true;
        setAbierto(true);
      });
      map.on("mouseenter", "casillas-hit", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "casillas-hit", () => (map.getCanvas().style.cursor = ""));
      setListo(true);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      capaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Datos → capa 3D y fuentes GeoJSON.
  useEffect(() => {
    const map = mapRef.current;
    if (!listo || !map) return;
    capaRef.current?.setCasillas(casillas);
    (map.getSource("casillas") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: casillas.map((c) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [c.lng, c.lat] },
        properties: { id: c.id, slug: c.slug, nombre: c.nombre },
      })),
    });
    (map.getSource("playas") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: playas.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: { nombre: p.nombre },
      })),
    });
  }, [listo, casillas, playas]);

  // Recorrido elegido → mapa (y encuadre).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !listo) return;
    type F = GeoJSON.Feature<GeoJSON.Geometry, Record<string, string>>;
    const features: F[] = [];
    const punto = (lon: number, lat: number, props: Record<string, string>): F => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: props,
    });
    if (origen) features.push(punto(origen.lon, origen.lat, { tipo: "origen" }));
    for (const t of ruta.opcion?.tramos ?? []) {
      if (t.tipo === "caminar") {
        features.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: [[t.desde.lon, t.desde.lat], [t.hasta.lon, t.hasta.lat]] },
          properties: { tipo: "pie" },
        });
      } else {
        features.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: t.geometria },
          properties: { tipo: "bus", linea: t.linea },
        });
        features.push(punto(t.subida.lon, t.subida.lat, { tipo: "parada", nombre: `Subí: ${t.subida.nombre}` }));
        features.push(punto(t.bajada.lon, t.bajada.lat, { tipo: "parada", nombre: `Bajá: ${t.bajada.nombre}` }));
      }
    }
    (map.getSource("ruta") as GeoJSONSource).setData({ type: "FeatureCollection", features });

    if (ruta.opcion) {
      const coords = features.flatMap((f) =>
        f.geometry.type === "Point"
          ? [f.geometry.coordinates as [number, number]]
          : (f.geometry as GeoJSON.LineString).coordinates as [number, number][],
      );
      const lons = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      map.fitBounds(
        [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ],
        { padding: padding(60, abiertoRef.current), pitch: 40, maxZoom: 16, duration: 1200 },
      );
    }
  }, [listo, origen, ruta.opcion]);

  // Ómnibus en vivo de la opción elegida.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !listo) return;
    const buses = ((ruta.opcion?.tramos.filter((t) => t.tipo === "omnibus") ?? []) as TramoBus[]).flatMap((t) =>
      (ruta.llegadas[claveTramo(t)] ?? []).map((l) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [l.lon, l.lat] },
        properties: { linea: t.linea },
      })),
    );
    (map.getSource("vivo") as GeoJSONSource).setData({ type: "FeatureCollection", features: buses });
  }, [listo, ruta]);

  // Selección → cámara, resaltado y URL.
  useEffect(() => {
    capaRef.current?.setSeleccion(casillaId);
  }, [casillaId, listo]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("playa", slug);
    else url.searchParams.delete("playa");
    window.history.replaceState(null, "", url);

    const map = mapRef.current;
    if (!map || !listo || !playa) return;
    const objetivo = casillas.find((c) => c.id === casillaId) ?? playa;
    const lng = "lng" in objetivo ? objetivo.lng : objetivo.lon;
    map.flyTo({
      center: [lng, objetivo.lat],
      zoom: casillaId ? 16.5 : 15.2,
      pitch: 60,
      padding: padding(0, abiertoRef.current),
      essential: true,
    });
  }, [slug, casillaId, listo, playa, casillas]);

  function elegirPlaya(p: Playa) {
    setSlug(p.slug);
    setCasillaId(p.guardavidas.length ? null : `playa:${p.slug}`);
    setBusqueda("");
  }

  function alternarPanel(valor = !abierto) {
    abiertoRef.current = valor;
    setAbierto(valor);
    // El mapa acompaña: recentra en el área que queda visible.
    mapRef.current?.easeTo({ padding: padding(0, valor), duration: 300 });
  }

  function cerrar() {
    setSlug(null);
    setCasillaId(null);
    setEligiendo(false);
    setRuta({ opcion: null, llegadas: {} });
  }

  function usarUbicacion() {
    if (!navigator.geolocation) {
      setErrorUbicacion("Tu navegador no permite obtener la ubicación. Elegila en el mapa.");
      return;
    }
    setUbicando(true);
    setErrorUbicacion(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicando(false);
        setOrigen({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        setUbicando(false);
        setErrorUbicacion("No pudimos obtener tu ubicación. Tocá el mapa para elegir el origen.");
        setEligiendo(true);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  // En móvil la hoja inferior baja al plegar; en escritorio se mueve todo el panel.
  const hoja = `transition-[translate,visibility] duration-300 ease-out motion-reduce:transition-none ${
    abierto ? "" : "max-md:invisible max-md:translate-y-[110%]"
  }`;

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div ref={contenedor} className="h-full w-full" />

      {/* Botón flotante para plegar/desplegar el panel (al lado del buscador) */}
      <button
        onClick={() => alternarPanel()}
        aria-expanded={abierto}
        aria-controls="panel-lateral"
        aria-label={abierto ? "Ocultar panel" : "Mostrar panel"}
        title={abierto ? "Ocultar panel" : "Mostrar panel"}
        className={`absolute right-3 top-3 z-20 grid h-12 w-12 place-items-center rounded-2xl bg-white/95 text-slate-600 shadow-lg ring-1 ring-black/5 backdrop-blur transition-[translate,color] duration-300 ease-out hover:text-slate-900 motion-reduce:transition-none md:left-4 md:right-auto md:top-4 dark:bg-slate-900/95 dark:text-slate-300 dark:ring-white/10 dark:hover:text-white ${
          abierto ? "md:translate-x-[356px]" : ""
        }`}
      >
        <span className="relative h-5 w-5" aria-hidden>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className={`absolute inset-0 transition duration-300 motion-reduce:transition-none ${abierto ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"}`}
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`absolute inset-0 transition duration-300 motion-reduce:transition-none ${abierto ? "rotate-90 opacity-0" : "rotate-0 opacity-100"}`}
          >
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d="M9 4v16M13.5 10l2 2-2 2" />
          </svg>
        </span>
      </button>

      <aside
        id="panel-lateral"
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-3 p-3 transition-[translate,visibility] duration-300 ease-out motion-reduce:transition-none md:inset-y-0 md:right-auto md:w-[380px] md:p-4 ${
          abierto ? "" : "md:invisible md:-translate-x-[calc(100%+1rem)]"
        }`}
      >
        {/* Buscador: filtra el listado de playas */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-white/95 px-4 py-3 shadow-lg ring-1 ring-black/5 backdrop-blur max-md:mr-14 dark:bg-slate-900/95 dark:ring-white/10">
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              if (playa) cerrar(); // buscar vuelve al listado
              if (!abierto) alternarPanel(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && busqueda && resultados[0]) elegirPlaya(resultados[0]);
              if (e.key === "Escape") setBusqueda("");
            }}
            placeholder="Buscar playa o casilla…"
            aria-label="Buscar playa"
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-slate-400"
          />
          {busqueda && (
            <button onClick={() => setBusqueda("")} className="text-sm text-slate-500" aria-label="Borrar búsqueda">
              ✕
            </button>
          )}
        </div>

        {/* Panel general (sin playa seleccionada) */}
        {!playa && (
          <section className={`${hoja} pointer-events-auto fixed inset-x-0 bottom-0 max-h-[45vh] overflow-y-auto rounded-t-3xl bg-slate-50 p-3 shadow-2xl ring-1 ring-black/5 md:static md:max-h-none md:min-h-0 md:rounded-2xl md:bg-transparent md:p-0 md:shadow-none md:ring-0 dark:bg-slate-950 md:dark:bg-transparent`}>
            <PanelGeneral
              playas={resultados}
              todas={playas}
              temporada={temporada}
              fuente={fuente}
              error={error}
              climaCiudad={climaCiudad}
              busqueda={busqueda}
              filtro={filtro}
              onFiltro={setFiltro}
              onElegir={elegirPlaya}
              origen={origen}
              ubicando={ubicando}
              onUsarUbicacion={usarUbicacion}
            />
          </section>
        )}

        {/* Detalle de la playa */}
        {playa && (
          <section className={`${hoja} pointer-events-auto fixed inset-x-0 bottom-0 max-h-[45vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl ring-1 ring-black/5 md:static md:max-h-none md:min-h-0 md:rounded-2xl md:shadow-lg dark:bg-slate-900 dark:ring-white/10`}>
            <Detalle
              playa={playa}
              temporada={temporada}
              casillaId={casillaId}
              onCasilla={setCasillaId}
              onCerrar={cerrar}
            />
            {destino && (
              <ComoIr
                destino={destino}
                origen={origen}
                eligiendoEnMapa={eligiendo}
                ubicando={ubicando}
                errorUbicacion={errorUbicacion}
                onUsarUbicacion={usarUbicacion}
                onElegirEnMapa={() => {
                  setErrorUbicacion(null);
                  setEligiendo(true);
                }}
                onCambiarOrigen={() => {
                  setOrigen(null);
                  setRuta({ opcion: null, llegadas: {} });
                }}
                onOpcion={onOpcion}
              />
            )}
          </section>
        )}
      </aside>
    </div>
  );
}

// Margen para que el panel no tape lo que se encuadra (izquierda en escritorio, abajo en móvil).
function padding(extra: number, panelAbierto: boolean) {
  const escritorio = window.matchMedia("(min-width: 768px)").matches;
  return escritorio
    ? { left: (panelAbierto ? 400 : 0) + extra, top: extra, right: 50 + extra, bottom: extra } // derecha: controles del mapa
    : {
        left: extra / 2,
        top: 70 + extra / 2,
        right: extra / 2,
        bottom: (panelAbierto ? window.innerHeight * 0.45 : 0) + extra / 2,
      };
}

function Detalle({
  playa,
  temporada,
  casillaId,
  onCasilla,
  onCerrar,
}: {
  playa: Playa;
  temporada: Temporada;
  casillaId: string | null;
  onCasilla: (id: string) => void;
  onCerrar: () => void;
}) {
  const c = playa.clima;
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{playa.nombre}</h2>
          {playa.descripcion && <p className="text-sm text-slate-500">{playa.descripcion}</p>}
        </div>
        <button
          onClick={onCerrar}
          className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      {c && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <Dato label="Aire" value={grados(c.airTemp)} sub={`ST ${grados(c.feelsLike)}`} />
          <Dato label="Agua" value={grados(c.waterTemp)} sub={c.waveHeight != null ? `Olas ${c.waveHeight.toFixed(1)} m` : ""} />
          <Dato label="Viento" value={`${Math.round(c.windSpeed)}`} sub={`km/h ${c.windDirectionLabel}`} />
          <Dato label="Hoy" value={`${grados(c.min)}/${grados(c.max)}`} sub={c.description} />
          <Dato label="UV" value={c.uvIndex.toFixed(0)} sub={c.uvIndex >= 6 ? "Alto" : c.uvIndex >= 3 ? "Moderado" : "Bajo"} />
          <Dato label="Humedad" value={`${c.humidity}%`} />
        </div>
      )}

      <Pronostico slug={playa.slug} />

      <h3 className="mt-5 mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
        Casillas de guardavidas ({playa.guardavidas.length})
      </h3>
      {!temporada.activa && (
        <p className="mb-2 text-xs text-slate-500">
          Servicio desde el {fechaFmt.format(new Date(temporada.inicio))}, de 8 a 20 h.
        </p>
      )}
      {playa.guardavidas.length === 0 ? (
        <p className="text-sm text-slate-500">Sin casillas informadas por la IM.</p>
      ) : (
        <ul className="space-y-1">
          {playa.guardavidas.map((g) => {
            const b = g.bandera ? BANDERAS[g.bandera] : null;
            return (
              <li key={g.id}>
                <button
                  onClick={() => onCasilla(g.id)}
                  className={`flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${
                    casillaId === g.id ? "bg-sky-50 dark:bg-slate-800" : ""
                  }`}
                >
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: b?.color ?? "#c9ced4" }} />
                  <span className="min-w-0">
                    <span className="block font-medium">{g.nombre}</span>
                    {g.direccion && <span className="block text-xs text-slate-500">{g.direccion}</span>}
                    <span className="block text-xs text-slate-600 dark:text-slate-400">
                      {b ? b.label : temporada.activa ? "Bandera sin datos" : "Sin servicio"}
                    </span>
                    {g.banderaSanitaria?.activa && (
                      <span className="mt-1 inline-block rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                        Bandera sanitaria{g.banderaSanitaria.causa ? `: ${g.banderaSanitaria.causa}` : ""}
                      </span>
                    )}
                  </span>
                </button>
                {g.comoIr && (
                  <a
                    href={g.comoIr}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-8 text-xs text-sky-700 underline dark:text-sky-300"
                  >
                    Cómo ir
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Dato({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2.5 py-2 dark:bg-slate-800">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums leading-tight">{value}</p>
      {sub && <p className="truncate text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}
