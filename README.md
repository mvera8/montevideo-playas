# Playas UY

Mapa 3D de las playas de Montevideo: buscador, casillas de guardavidas con su bandera
flameando (color real de la IM, dirección según el viento) y temperatura de aire y agua por playa.

- Playas y guardavidas: [Montevideo API de la IM](https://api.montevideo.gub.uy/apidocs/beaches) (OAuth2 client_credentials).
- Clima: [Open-Meteo](https://open-meteo.com) (forecast + marine, sin API key). La IM no publica clima.

## Configuración

```bash
cp .env.example .env.local   # completar IM_CLIENT_ID e IM_CLIENT_SECRET (y Supabase para los me gusta)
npm run dev
```

Sin credenciales la página muestra una lista de playas de respaldo con clima pero sin guardavidas.

## API

| Endpoint | Devuelve |
| --- | --- |
| `GET /api/playas` | Playas con sus casillas de guardavidas y clima |
| `GET /api/guardavidas` | Casillas (lista plana) y estado de la temporada |
| `GET /api/clima` | Clima actual en Montevideo |
| `GET /api/clima/[playa]` | Clima en una playa, p. ej. `/api/clima/pocitos` |
| `GET /api/pronostico/[playa]` | Pronóstico hora a hora (hoy y mañana) y mejor franja para ir |
| `POST /api/viajes` `{desde:{lat,lon}}` | Minutos y líneas para llegar ahora a cada playa (para el ranking) |
| `POST /api/como-ir` `{desde, hasta}` | Opciones en ómnibus (directas o con 1 trasbordo) |
| `GET /api/omnibus/llegadas?tramos=variante:parada,...` | Estimación en vivo de los próximos ómnibus |

Si la IM informa vencimiento de la bandera, se respeta; si no lo informa, la bandera solo
se considera válida en temporada (15/11 – 30/04). Fuera de temporada aparecen grises ("sin servicio").

## Mapa 3D

- Mapa: [MapLibre GL](https://maplibre.org) con tiles de [OpenFreeMap](https://openfreemap.org) (sin API key).
- Casillas: Three.js renderizado **dentro del contexto WebGL del mapa** (custom layer).
  Todas las casillas son un `InstancedMesh` y todas las banderas otro → 2 draw calls en total.
  El flameo es un vertex shader; solo se anima a zoom ≥ 13, a 30 fps, y se pausa con la pestaña oculta
  o con `prefers-reduced-motion`.
- El worker de MapLibre se copia a `public/maplibre` en `postinstall`.
- La IM agrupa casillas por código de playa (`beach`); su endpoint `/beaches` devuelve casillas, no playas.
- `?playa=pocitos` en la URL abre directamente esa playa.

## Calidad del agua

Datos abiertos de la IM ([monitoreo de agua de playas](https://catalogodatos.gub.uy/dataset/monitoreo-de-agua-de-playas)):
muestreos de todo el año por punto (enterococos, cianobacterias, temperatura medida) y la media
geométrica de 5 muestras que publica la IM. `src/lib/calidad-agua.ts` los cruza por playa.

- **Frecuencia**: la IM muestrea cada punto cada ~4 días (p90: 7) todo el año; regenera el CSV una
  vez por día y publica con ~1 semana de demora. Un análisis con más de 21 días se muestra como
  "sin muestreo reciente" (`DIAS_VIGENCIA`).
- **Actualización sin cron**: cada 3 h un `HEAD` (~100 ms) compara el ETag; solo si cambió se
  descarga. El servidor de la IM no soporta Range ni pedidos condicionales, pero el CSV viene del más
  nuevo al más viejo: se lee en streaming y se corta la descarga al llegar a datos de más de 120 días
  (~48 KB en vez de 2,2 MB).

- Criterio del **Decreto 226/025** (la IM lo aplica desde el 27/03/2026): supera el límite si la media
  de 5 muestras (≤ 40 días) pasa 200 enterococos/100 ml o una muestra pasa 500.
- Es un cálculo con datos públicos: la **habilitación oficial** la comunica la IM (bandera sanitaria).
- Datos con más de 21 días se muestran como "sin muestreo reciente".
- Entra en el ranking: agua fuera de límite resta 30; cianobacterias restan o descartan la playa.

## Baños, bebederos y duchas cercanos

`src/lib/servicios.ts` combina dos fuentes, a menos de 600 m de las casillas de cada playa:

- **IM** ([equipamiento urbano](https://catalogodatos.gub.uy/dataset/equipamiento-urbano-espacios-publicos)):
  shapefile en UTM 21S (se convierte a lat/lon), solo los marcados como activos. Cubre sobre todo plazas
  y parques. No se muestran sus observaciones porque varias están desactualizadas (p. ej. "cerrado por Covid").
- **OpenStreetMap** (Overpass, una consulta por día): baños de la rambla, químicos de temporada, bebederos
  y duchas. Se descartan los cerrados o privados, y los que están a menos de 40 m de uno de la IM.

- **Fechas**: OSM se pide con `out center meta`. Se usa `check_date`/`survey:date` ("verificado") o,
  si no hay, la última edición ("editado"); con más de 2 años (`DIAS_VIGENCIA_OSM`) se avisa "dato viejo"
  y el ícono se ve tenue. Cerca de las playas ninguno tiene `check_date` (medido 10/2026): varios baños
  fijos no se editan desde 2017-2023. La IM no trae fecha por punto (regenera el registro a diario).
- **Overpass** a veces responde 504/429 (saturado): un reintento a los 2 s; si falla, quedan los datos
  anteriores. Los espejos públicos probados (kumi.systems, private.coffee) no respondieron.

Cache en memoria de 24 h; si una fuente falla se sigue con la otra. En el mapa: íconos desde zoom 13,5
con popup (armado con DOM/textContent, los datos de OSM son texto libre).

## ¿A qué playa voy? y mejor horario

Lógica pura en `src/lib/recomendacion.ts` (sirve en cliente y servidor):

- **Ranking (0–100)**: bandera vigente (roja/negra la descartan), bandera sanitaria, viento según
  la **orientación de cada playa** (de frente = olas y frío; de tierra = reparada), sensación
  térmica, lluvia, olas, si es de noche y, con la ubicación del usuario, el tiempo de viaje.
  La orientación (hacia dónde está el agua) se calcula **por casilla** con la línea de costa de
  OpenStreetMap (`natural=coastline`: el agua queda a la derecha del trazo) y se guarda en
  `src/data/orientaciones.json`. La costa no cambia, así que no se consulta en runtime: regenerar con
  `npm run orientaciones` si la IM agrega o mueve casillas (Overpass suele dar 504; el script
  reintenta). Las casillas que falten usan la tabla `ORIENTACION` como respaldo. La playa usa el
  promedio circular de sus casillas. Las casillas 3D se giran con ese rumbo: frente y rampa al agua.
- **Mejor horario**: puntaje por hora (sensación, lluvia, UV, viento de frente, ráfagas,
  tormenta) y la mejor franja de 2–4 h de sol, hoy o mañana. Gráfico en
  `src/components/mapa/Pronostico.tsx`.

## Cómo ir en ómnibus

La API de transporte de la IM requiere **otra aplicación** en el portal (cada app se asocia a
un solo servicio): `IM_TRANSPORTE_CLIENT_ID` / `IM_TRANSPORTE_CLIENT_SECRET`.

- La IM no ofrece ruteo: el planificador (`src/lib/transporte/planificador.ts`) usa el **GTFS**
  del STM (paradas, horarios y recorridos). Busca viajes directos y con un trasbordo, con paradas
  a ≤ 900 m del origen y ≤ 800 m de la playa, y ordena por hora de llegada.
- El GTFS (~17 MB) se descarga una vez por versión, se guarda en el directorio temporal y se
  procesa en streaming (~2 s). `src/instrumentation.ts` lo precarga al iniciar el servidor.
- En vivo: `upcomingbuses` de la IM devuelve vacío, así que la llegada se estima proyectando la
  posición GPS de cada ómnibus (`/buses`) sobre el recorrido de su variante
  (en este feed `shape_id` = `lineVariantId`). `/buses` se consulta como máximo cada 15 s para
  todos los usuarios, por el límite de uso de la IM.
- No contempla feriados ni horarios especiales.

## Me gusta

Dato **propio del sitio** (no es una fuente externa). Base: Supabase, proyecto `montevideo-playas`
(`xosgpsubckqhzzermohv`, us-east-2). Esquema en `supabase/migrations/` (aplicado con el conector de
Supabase; para recrearlo, correr ese SQL en el SQL Editor).

- **Cuenta anónima** (Supabase Auth, `signInAnonymously`): requiere *Authentication → Sign In /
  Providers → Allow anonymous sign-ins* activado en el dashboard. La sesión queda en
  `localStorage` (`sb-<ref>-auth-token`). Más adelante se puede convertir en cuenta con Google o
  correo (`linkIdentity` / `updateUser`) y conserva sus me gusta (pensado para el Rey de la playa).
- **Tablas:** `me_gusta` (playa, temporada, user_id; PK única = uno por persona por playa por
  temporada; RLS: cada uno ve/da/saca solo los suyos, solo en la temporada actual; un trigger pone
  un tope de 60 por temporada por cuenta — no hacerlo en la política: recursa sobre la tabla) y `me_gusta_totales` (contador precalculado por un trigger; lo único público).
- **Temporada:** de julio a junio (`'2026-27'`), calculada en la base (`temporada_actual()`) y en
  `temporadaMeGusta()` de `src/lib/me-gusta.ts`. "En total" = suma de todas las temporadas.
- **Lectura (servidor):** `GET {URL}/rest/v1/me_gusta_totales?select=playa,temporada,total` con
  header `apikey: <clave publicable>`. ~20 filas por temporada. Cache 5 min (igual que el ISR de la
  página); si falla, la página sale sin me gusta.
- **Escritura (navegador):** RPC `alternar_me_gusta(p_playa)` devuelve `{meGusta, temporada,
  siempre}` en un solo viaje. **Solo si el navegador ya tiene sesión:** al cargar, dos consultas en
  paralelo (`me_gusta` de la temporada, que por RLS trae solo las propias, para pintar las tarjetas
  en rojo, y `me_gusta_totales` al día, para no mostrar "te gusta" con el 0 cacheado) y
  `estado_me_gusta(p_playa)` al abrir una playa. supabase-js se importa de forma diferida: quien nunca dio me gusta
  no lo descarga. Actualización optimista.
- **Validar:** `curl -X POST {URL}/rest/v1/rpc/temporada_actual -H "apikey: …"` → `"2026-27"`; el
  conector (`get_advisors`) no debe mostrar avisos de seguridad.
- **Vigencia:** es un contador en vivo, no hay dato vencido; el número puede atrasar ≤5 min.
- **Abuso:** Supabase limita la creación de cuentas anónimas por IP (30/h por defecto). Si se
  infla, activar CAPTCHA (Turnstile) en Auth. Limpiar cuentas anónimas sin uso de más de un año.
- **Plan gratis:** el proyecto se pausa tras 7 días sin actividad; en ese caso no se muestran me
  gusta hasta reactivarlo.
- No se suma al puntaje de "¿A qué playa voy?" (siempre ganaría Pocitos).

## Legal y privacidad

- Páginas `/terminos` (incluye fuentes y licencias) y `/privacidad`. Completar los datos de
  `src/lib/sitio.ts` (responsable, contacto, hosting) antes de publicar.
- Las rutas que reciben la ubicación usan **POST** (nunca la ubicación en la URL), responden
  `Cache-Control: no-store` y no registran coordenadas. El cliente la redondea a ~100 m.
- **Open-Meteo** gratis es solo para uso no comercial: para un uso comercial hace falta un plan pago.

## Código

- `src/lib/im.ts` — token OAuth2 (cacheado) y llamadas a la IM
- `src/lib/weather.ts` — Open-Meteo, todas las playas en 2 requests
- `src/lib/playas.ts` — une playas + casillas + clima, lógica de temporada
- `src/lib/transporte/` — GTFS, planificador y tiempo real
- `src/lib/me-gusta.ts` / `me-gusta-cliente.ts` — totales (servidor) y botón ❤️ (navegador, Supabase)
- `src/components/mapa/Mapa.tsx` — mapa, buscador y panel de detalle
- `src/components/mapa/ComoIr.tsx` — UI de "cómo llegar en ómnibus"
- `src/components/mapa/capa-casillas.ts` — capa Three.js (instancing + shader de bandera)
- `src/components/mapa/modelo.ts` — geometría low-poly de la casilla
- `src/app/page.tsx` — página principal

## Extender a todo Uruguay (investigado 10/2026, no integrado)

Fuentes nacionales verificadas, para cuando se quiera cubrir otros departamentos:

- **GeoServer del Ministerio de Ambiente** (WFS, GeoJSON, sin clave):
  `https://www.ambiente.gub.uy/geoserver/u19600217/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=u19600217:<capa>&outputFormat=application/json&srsName=EPSG:4326`
  - `c388` **Playas**: 237 playas con nombre y departamento (Rocha 68, Maldonado 41, Canelones 38,
    Colonia 36, Montevideo 19, …). ~55 KB.
  - `c919` **Banderas sanitarias**: 347 puntos (187 activos) de la Red de Monitoreo de Playas
    (14 intendencias). Solo se carga del 1/12 al 31/3; fuera de temporada no hay clasificación.
  - `c1529` **Estaciones de monitoreo de calidad de agua**: 111 estaciones de programa "Playa" en
    15 departamentos, con series históricas embebidas en el campo `json`. Pesa **8,8 MB**: filtrar
    con `CQL_FILTER=nombre_programa='Playa'` y `propertyName`. Casi todas miden coliformes
    termotolerantes (`TermoTMF`); **enterococos solo 23 estaciones** (el Decreto 226/025 usa
    enterococos). Fuera de temporada el muestreo es mensual o se corta: varios departamentos tienen
    el último dato en marzo.
- **Sin fuente abierta encontrada**: casillas y banderas de seguridad de guardavidas fuera de
  Montevideo. Canelones tiene la app propia SIMAS (82 torres) pero sin API pública conocida.
- Ya son nacionales: clima (Open-Meteo), mapa y servicios (OpenStreetMap). El transporte (GTFS STM)
  es solo Montevideo; el MTOP publica horarios interdepartamentales en el catálogo de datos abiertos.
