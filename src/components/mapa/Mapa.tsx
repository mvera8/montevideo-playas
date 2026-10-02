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
import { useEffect, useMemo, useRef, useState } from "react";
import type { Guardavidas, Playa, Temporada } from "@/lib/playas";
import type { Weather } from "@/lib/weather";
import { CapaCasillas, type CasillaMapa } from "./capa-casillas";

// Copiado por scripts/copiar-worker-maplibre.mjs (postinstall).
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const ESTILO = "https://tiles.openfreemap.org/styles/positron";
const CENTRO: [number, number] = [-56.17, -34.9];

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
  const [abierto, setAbierto] = useState(false);
  // El componente solo corre en el cliente (ssr: false), así que podemos leer la URL acá.
  const [slug, setSlug] = useState<string | null>(() => {
    const inicial = new URLSearchParams(window.location.search).get("playa");
    return inicial && playas.some((p) => p.slug === inicial) ? inicial : null;
  });
  const [casillaId, setCasillaId] = useState<string | null>(null);

  const casillas = useMemo(() => aCasillas(playas), [playas]);
  const playa = playas.find((p) => p.slug === slug) ?? null;

  const resultados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return playas;
    return playas.filter(
      (p) =>
        normalizar(p.nombre).includes(q) ||
        p.guardavidas.some((g) => normalizar(g.nombre).includes(q)),
    );
  }, [busqueda, playas]);

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
      fitBoundsOptions: { padding: 40 },
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

      map.on("click", "casillas-hit", (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f) return;
        setSlug(f.properties.slug as string);
        setCasillaId(f.properties.id as string);
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
    const escritorio = window.matchMedia("(min-width: 768px)").matches;
    map.flyTo({
      center: [lng, objetivo.lat],
      zoom: casillaId ? 16.5 : 15.2,
      pitch: 60,
      padding: escritorio
        ? { left: 400, top: 0, right: 0, bottom: 0 }
        : { left: 0, top: 0, right: 0, bottom: window.innerHeight * 0.45 },
      essential: true,
    });
  }, [slug, casillaId, listo, playa, casillas]);

  function elegirPlaya(p: Playa) {
    setSlug(p.slug);
    setCasillaId(p.guardavidas.length ? null : `playa:${p.slug}`);
    setBusqueda("");
    setAbierto(false);
  }

  function cerrar() {
    setSlug(null);
    setCasillaId(null);
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div ref={contenedor} className="h-full w-full" />

      <aside className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-3 p-3 md:inset-y-0 md:right-auto md:w-[380px] md:p-4">
        {/* Buscador */}
        <div className="pointer-events-auto relative">
          <div className="flex items-center gap-2 rounded-2xl bg-white/95 px-4 py-3 shadow-lg ring-1 ring-black/5 backdrop-blur dark:bg-slate-900/95 dark:ring-white/10">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setAbierto(true);
              }}
              onFocus={() => setAbierto(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && resultados[0]) elegirPlaya(resultados[0]);
                if (e.key === "Escape") setAbierto(false);
              }}
              placeholder="Buscar playa o casilla…"
              aria-label="Buscar playa"
              className="w-full bg-transparent text-[15px] outline-none placeholder:text-slate-400"
            />
            {abierto && (
              <button onClick={() => setAbierto(false)} className="text-sm text-slate-500" aria-label="Cerrar lista">
                ✕
              </button>
            )}
          </div>

          {abierto && (
            <ul className="absolute inset-x-0 top-full mt-2 max-h-[50vh] overflow-y-auto rounded-2xl bg-white/95 py-1 shadow-lg ring-1 ring-black/5 backdrop-blur dark:bg-slate-900/95 dark:ring-white/10">
              {resultados.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">Sin resultados</li>}
              {resultados.map((p) => (
                <li key={p.slug}>
                  <button
                    onClick={() => elegirPlaya(p)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-sky-50 dark:hover:bg-slate-800"
                  >
                    <span>
                      <span className="block font-medium">{p.nombre}</span>
                      <span className="block text-xs text-slate-500">
                        {p.guardavidas.length} {p.guardavidas.length === 1 ? "casilla" : "casillas"}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <PuntosBanderas g={p.guardavidas} />
                      <span className="tabular-nums text-sm text-slate-600 dark:text-slate-300">
                        {grados(p.clima?.airTemp)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Avisos y resumen de la ciudad (sin playa seleccionada) */}
        {!playa && !abierto && (
          <div className="pointer-events-auto hidden space-y-3 md:block">
            {climaCiudad && <ResumenCiudad clima={climaCiudad} />}
            <Avisos temporada={temporada} fuente={fuente} error={error} />
          </div>
        )}

        {/* Detalle de la playa */}
        {playa && !abierto && (
          <section className="pointer-events-auto fixed inset-x-0 bottom-0 max-h-[45vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl ring-1 ring-black/5 md:static md:max-h-none md:rounded-2xl md:shadow-lg dark:bg-slate-900 dark:ring-white/10">
            <Detalle
              playa={playa}
              temporada={temporada}
              casillaId={casillaId}
              onCasilla={setCasillaId}
              onCerrar={cerrar}
            />
          </section>
        )}
      </aside>
    </div>
  );
}

function PuntosBanderas({ g }: { g: Guardavidas[] }) {
  const colores = [...new Set(g.map((x) => x.bandera).filter(Boolean))] as NonNullable<Guardavidas["bandera"]>[];
  if (!colores.length) return null;
  return (
    <span className="flex -space-x-1">
      {colores.map((c) => (
        <span key={c} className="h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900" style={{ background: BANDERAS[c].color }} />
      ))}
    </span>
  );
}

function ResumenCiudad({ clima }: { clima: Weather }) {
  return (
    <div className="rounded-2xl bg-sky-600/95 p-4 text-white shadow-lg backdrop-blur dark:bg-sky-900/95">
      <p className="text-xs uppercase tracking-wider text-sky-100">Montevideo ahora</p>
      <div className="mt-1 flex items-end justify-between">
        <p className="text-4xl font-semibold tabular-nums">{grados(clima.airTemp)}</p>
        <p className="text-right text-sm text-sky-100">
          {clima.description}
          <br />
          Agua {grados(clima.waterTemp)} · Viento {Math.round(clima.windSpeed)} km/h {clima.windDirectionLabel}
        </p>
      </div>
    </div>
  );
}

function Avisos({ temporada, fuente, error }: Pick<Props, "temporada" | "fuente" | "error">) {
  return (
    <>
      {!temporada.activa && (
        <div className="rounded-2xl bg-white/95 p-4 text-sm shadow-lg ring-1 ring-black/5 dark:bg-slate-900/95 dark:ring-white/10">
          <strong>Fuera de temporada.</strong> El servicio de guardavidas comienza el{" "}
          {fechaFmt.format(new Date(temporada.inicio))}, de 8 a 20 h. Las banderas grises indican que
          no hay datos vigentes.
        </div>
      )}
      {fuente === "respaldo" && (
        <div className="rounded-2xl bg-amber-50/95 p-4 text-sm text-amber-900 shadow-lg ring-1 ring-amber-200 dark:bg-amber-950/95 dark:text-amber-200 dark:ring-amber-800">
          <strong>Sin datos de la Intendencia.</strong> Se muestran playas de respaldo.
          {error && <span className="mt-1 block text-xs opacity-80">{error}</span>}
        </div>
      )}
    </>
  );
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
