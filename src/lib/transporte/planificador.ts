import "server-only";
import { distancia, getIndice, paradasCerca, type Indice, type Patron } from "./gtfs";

// Planificador simple: viajes directos y con un trasbordo, usando los horarios del GTFS.
// La API de la IM no ofrece ruteo, así que lo resolvemos acá.

const VEL_CAMINATA = 75; // m/min (~4.5 km/h)
const DESVIO = 1.25; // las calles no van en línea recta
const R_ORIGEN = 900;
const R_DESTINO = 800;
const R_TRASBORDO = 250;
const MAX_ESPERA = 60;
const MAX_VIAJE = 90;
const PENALIDAD_TRASBORDO = 5;
const MAX_OPCIONES = 4;

export type Punto = { lat: number; lon: number };
export type ParadaInfo = { id: string; nombre: string; lat: number; lon: number };

export type Tramo =
  | { tipo: "caminar"; metros: number; minutos: number; desde: Punto; hasta: Punto }
  | {
      tipo: "omnibus";
      linea: string;
      destino: string;
      variante: number;
      subida: ParadaInfo;
      bajada: ParadaInfo;
      paradas: number;
      minutos: number;
      espera: number;
      sale: string; // HH:MM en la parada de subida, según horario
      siguientes: string[];
      geometria: [number, number][];
    };

export type Opcion = { minutos: number; sale: string; llega: string; tramos: Tramo[] };

// ---------- tiempo ----------

const partesMvd = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Montevideo",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const DIAS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ahoraMvd(fecha = new Date()) {
  const p = Object.fromEntries(partesMvd.formatToParts(fecha).map((x) => [x.type, x.value]));
  return { dia: DIAS.indexOf(p.weekday), minutos: Number(p.hour) * 60 + Number(p.minute) };
}

export const hhmm = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

// Servicios vigentes: los de hoy y los de ayer que siguen pasada la medianoche (horarios 24:xx).
function serviciosVigentes(ix: Indice, dia: number) {
  const ayer = (dia + 6) % 7;
  const out: { id: string; desfase: number }[] = [];
  for (const [id, dias] of ix.calendario) {
    if (dias[dia]) out.push({ id, desfase: 0 });
    if (dias[ayer]) out.push({ id, desfase: -1440 });
  }
  return out;
}

function primeraMayorIgual(arr: number[], v: number) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

type Servicios = ReturnType<typeof serviciosVigentes>;

/** Próximos pasos del patrón por la parada en `pos` desde el minuto `t` (minutos desde medianoche de hoy). */
function proximosPasos(p: Patron, pos: number, t: number, servicios: Servicios, cuantos = 1) {
  const out: number[] = [];
  for (const s of servicios) {
    const sal = p.salidas.get(s.id);
    if (!sal) continue;
    const off = p.minutos[pos] + s.desfase;
    const i0 = primeraMayorIgual(sal, t - off);
    for (let i = i0; i < sal.length && i < i0 + cuantos; i++) out.push(sal[i] + off);
  }
  return out.sort((a, b) => a - b).slice(0, cuantos);
}

// ---------- geometría ----------

function cortarForma(p: Patron, desde: number, hasta: number): [number, number][] {
  const d0 = p.distParadas[desde], d1 = p.distParadas[hasta];
  const out: [number, number][] = [];
  const interp = (d: number): [number, number] => {
    const j = Math.max(0, primeraMayorIgual(p.distForma, d) - 1);
    const a = p.distForma[j], b = p.distForma[j + 1] ?? a;
    const t = b > a ? (d - a) / (b - a) : 0;
    return [
      p.forma[j * 2] + t * ((p.forma[j * 2 + 2] ?? p.forma[j * 2]) - p.forma[j * 2]),
      p.forma[j * 2 + 1] + t * ((p.forma[j * 2 + 3] ?? p.forma[j * 2 + 1]) - p.forma[j * 2 + 1]),
    ];
  };
  out.push(interp(d0));
  for (let j = 0; j < p.distForma.length; j++)
    if (p.distForma[j] > d0 && p.distForma[j] < d1) out.push([p.forma[j * 2], p.forma[j * 2 + 1]]);
  out.push(interp(d1));
  return out;
}

const caminata = (metros: number) => (metros * DESVIO) / VEL_CAMINATA;

// ---------- búsqueda ----------

type Candidato = {
  total: number; // minuto de llegada (desde medianoche)
  rank: number;
  tramos: {
    patron: number;
    sube: number;
    baja: number;
    pasa: number; // minuto en que pasa por la parada de subida
  }[];
  caminatas: number[]; // metros: [origen→subida, (bajada→subida2), bajada→destino]
};

export async function planificar(origen: Punto, destino: Punto, fecha = new Date()): Promise<Opcion[]> {
  const ix = await getIndice();
  const { dia, minutos: ahora } = ahoraMvd(fecha);
  const servicios = serviciosVigentes(ix, dia);

  const origenes = paradasCerca(ix, origen.lat, origen.lon, R_ORIGEN);
  const destinos = paradasCerca(ix, destino.lat, destino.lon, R_DESTINO);

  // patrón → paradas cercanas al destino que recorre (posición + metros a pie).
  const bajadas = new Map<number, { pos: number; metros: number }[]>();
  for (const d of destinos)
    for (const [pi, pos] of ix.porParada[d.parada]) {
      const l = bajadas.get(pi) ?? [];
      l.push({ pos, metros: d.metros });
      bajadas.set(pi, l);
    }

  const mejorBajada = (pi: number, despuesDe: number) => {
    const p = ix.patrones[pi];
    let mejor: { pos: number; metros: number; costo: number } | null = null;
    for (const b of bajadas.get(pi) ?? []) {
      if (b.pos <= despuesDe) continue;
      const costo = p.minutos[b.pos] - p.minutos[despuesDe] + caminata(b.metros);
      if (!mejor || costo < mejor.costo) mejor = { ...b, costo };
    }
    return mejor;
  };

  const candidatos = new Map<string, Candidato>();
  const guardar = (clave: string, c: Candidato) => {
    const prev = candidatos.get(clave);
    if (!prev || c.rank < prev.rank) candidatos.set(clave, c);
  };

  const cercanas = new Map<number, { parada: number; metros: number }[]>();
  const vecinas = (s: number) => {
    let v = cercanas.get(s);
    if (!v) cercanas.set(s, (v = paradasCerca(ix, ix.paradas[s].lat, ix.paradas[s].lon, R_TRASBORDO)));
    return v;
  };

  for (const o of origenes) {
    const tEnParada = ahora + caminata(o.metros);
    for (const [p1, pos1] of ix.porParada[o.parada]) {
      const pat1 = ix.patrones[p1];
      const [pasa1] = proximosPasos(pat1, pos1, tEnParada, servicios);
      if (pasa1 === undefined || pasa1 - tEnParada > MAX_ESPERA) continue;

      // Directo.
      const b = mejorBajada(p1, pos1);
      if (b) {
        const total = pasa1 + b.costo;
        guardar(pat1.linea, {
          total,
          rank: total,
          tramos: [{ patron: p1, sube: pos1, baja: b.pos, pasa: pasa1 }],
          caminatas: [o.metros, b.metros],
        });
      }

      // Un trasbordo.
      for (let k = pos1 + 1; k < pat1.paradas.length; k++) {
        const viaje1 = pat1.minutos[k] - pat1.minutos[pos1];
        if (viaje1 > MAX_VIAJE) break;
        const tBaja = pasa1 + viaje1;
        for (const t of vecinas(pat1.paradas[k])) {
          const tEnParada2 = tBaja + caminata(t.metros);
          for (const [p2, pos2] of ix.porParada[t.parada]) {
            const pat2 = ix.patrones[p2];
            if (pat2.linea === pat1.linea || !bajadas.has(p2)) continue;
            const b2 = mejorBajada(p2, pos2);
            if (!b2) continue;
            const clave = `${pat1.linea}>${pat2.linea}`;
            const cota = tEnParada2 + b2.costo + PENALIDAD_TRASBORDO;
            const prev = candidatos.get(clave);
            if (prev && cota >= prev.rank) continue;
            const [pasa2] = proximosPasos(pat2, pos2, tEnParada2, servicios);
            if (pasa2 === undefined || pasa2 - tEnParada2 > MAX_ESPERA) continue;
            const total = pasa2 + b2.costo;
            guardar(clave, {
              total,
              rank: total + PENALIDAD_TRASBORDO,
              tramos: [
                { patron: p1, sube: pos1, baja: k, pasa: pasa1 },
                { patron: p2, sube: pos2, baja: b2.pos, pasa: pasa2 },
              ],
              caminatas: [o.metros, t.metros, b2.metros],
            });
          }
        }
      }
    }
  }

  // Ordenar; descartar trasbordos que no mejoran claramente al mejor directo.
  const ordenados = [...candidatos.values()].sort((a, b) => a.rank - b.rank);
  const mejorDirecto = ordenados.find((c) => c.tramos.length === 1);
  const elegidos = ordenados
    .filter((c) => c.tramos.length === 1 || !mejorDirecto || c.total < mejorDirecto.total - 5)
    .slice(0, MAX_OPCIONES);

  const opciones = elegidos.map((c) => armarOpcion(ix, c, origen, destino, ahora, servicios));

  // Si queda cerca, caminar también es una opción (y suele ser la mejor).
  const metrosDirecto = distancia(origen.lat, origen.lon, destino.lat, destino.lon);
  const minCaminando = caminata(metrosDirecto);
  if (minCaminando <= 30) {
    opciones.push({
      minutos: Math.round(minCaminando),
      sale: hhmm(ahora),
      llega: hhmm(ahora + minCaminando),
      tramos: [{ tipo: "caminar", metros: Math.round(metrosDirecto * DESVIO), minutos: Math.round(minCaminando), desde: origen, hasta: destino }],
    });
  }
  return opciones.sort((a, b) => a.minutos - b.minutos);
}

function armarOpcion(ix: Indice, c: Candidato, origen: Punto, destino: Punto, ahora: number, servicios: Servicios): Opcion {
  const info = (i: number): ParadaInfo => {
    const p = ix.paradas[i];
    return { id: p.id, nombre: p.nombre, lat: p.lat, lon: p.lon };
  };
  const tramos: Tramo[] = [];
  let desde: Punto = origen;
  let reloj = ahora; // minuto en que termina el tramo anterior

  c.tramos.forEach((t, i) => {
    const p = ix.patrones[t.patron];
    const subida = info(p.paradas[t.sube]);
    const metros = c.caminatas[i];
    if (metros > 20)
      tramos.push({ tipo: "caminar", metros: Math.round(metros * DESVIO), minutos: Math.round(caminata(metros)), desde, hasta: subida });
    const llegadaAParada = reloj + caminata(metros);
    reloj = t.pasa + p.minutos[t.baja] - p.minutos[t.sube];
    const bajada = info(p.paradas[t.baja]);
    tramos.push({
      tipo: "omnibus",
      linea: p.linea,
      destino: p.destino,
      variante: p.variante,
      subida,
      bajada,
      paradas: t.baja - t.sube,
      minutos: Math.round(p.minutos[t.baja] - p.minutos[t.sube]),
      espera: Math.max(0, Math.round(t.pasa - llegadaAParada)),
      sale: hhmm(t.pasa),
      siguientes: proximosPasos(p, t.sube, t.pasa + 0.5, servicios, 2).map(hhmm),
      geometria: cortarForma(p, t.sube, t.baja),
    });
    desde = bajada;
  });

  const ultima = c.caminatas[c.caminatas.length - 1];
  if (ultima > 20)
    tramos.push({ tipo: "caminar", metros: Math.round(ultima * DESVIO), minutos: Math.round(caminata(ultima)), desde, hasta: destino });

  return { minutos: Math.round(c.total - ahora), sale: hhmm(ahora), llega: hhmm(c.total), tramos };
}
