# Playas UY

Mapa 3D de las playas de Montevideo: buscador, casillas de guardavidas con su bandera
flameando (color real de la IM, dirección según el viento) y temperatura de aire y agua por playa.

- Playas y guardavidas: [Montevideo API de la IM](https://api.montevideo.gub.uy/apidocs/beaches) (OAuth2 client_credentials).
- Clima: [MET Norway](https://api.met.no) y mar (agua y olas) de NOAA, sin API key y con uso comercial
  permitido (ver "Clima y mar"). La IM no publica clima.

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
- `/playas?playa=pocitos` abre directamente esa playa.

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

## Clima y mar

Todas las fuentes son gratis **también para uso comercial** (con publicidad), citando la fuente.
Antes se usaba Open-Meteo, que gratis es solo para uso no comercial.

- **Clima — MET Norway** Locationforecast 2.0 (`src/lib/weather.ts`):
  `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=-34.90&lon=-56.15` (JSON, CC BY 4.0).
  - Sin API key, pero **exige `User-Agent` con la app y un contacto** (sin eso, 403). Límite: 20
    pedidos/s; pide respetar `Expires` (~30 min).
  - Un punto por pedido: se redondea a 0,05° (la grilla global es de ~9 km) y se cachea 30 min, así
    todas las playas de Montevideo son unos pocos pedidos cada media hora.
  - ~60 h hora a hora (después cada 6 h), horas en UTC. Se actualiza varias veces por día (`meta.updated_at`).
  - Fuera de Noruega no trae ráfagas, probabilidad de lluvia (sí mm/h), UV real (solo con cielo
    despejado) ni amanecer/atardecer: la lluvia se muestra en mm, el UV como máximo posible y el sol se
    calcula localmente (`src/lib/sol.ts`). Mín/máx de "hoy" es de las horas que quedan del día.
  - "Es de día" (tema noche del mapa, widget, "De noche" del ranking) se recalcula en el navegador
    con su hora (`useEsDeDia` en `Mapa.tsx`): el HTML puede ser de una regeneración ISR de anoche.
  - El cielo viene como `symbol_code` y se traduce a códigos WMO (`SIMBOLO`).
- **Temperatura del agua — NOAA OISST v2.1 NRT** (`src/lib/mar.ts`), por ERDDAP:
  `https://coastwatch.pfeg.noaa.gov/erddap/griddap/ncdcOisst21NrtAgg_LonPM180.csv?sst[(last)][(0.0)][(-35.5):(-34.5)][(-56.5):(-55.5)]`
  (corchetes codificados). Diaria, 0,25°, ~1 día de demora (medido 04/10/2026). Si tiene más de 4
  días (`DIAS_VIGENCIA_SST`) no se muestra. Cache 6 h. Si la IM midió la temperatura, manda la de la IM.
- **Olas — WaveWatch III global de PacIOOS/NOAA** (`src/lib/mar.ts`):
  `https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ww3_global.csv?Thgt[(desde):(hasta)][(0.0)][(lat)][(lon)]`
  (longitud 0–360). Hora a hora, 7 días, 0,5°: en el Río de la Plata es la ola de afuera, orientativa. Cache 1 h.
- En ERDDAP las celdas de tierra vienen como `NaN`: se pide una cajita de ±0,5° y se usa la celda con
  dato más cercana. Timeout de 10 s; si el mar falla, la app sigue sin agua ni olas. Si un servidor no
  responde (timeout, error de red o 5xx) no se vuelve a consultar por 5 min, para no esperar el timeout en
  cada render (los pedidos fallidos no quedan en la caché de datos).

## Alertas de INUMET

`src/lib/inumet.ts` trae las **advertencias meteorológicas vigentes para Montevideo** y
`AlertaInumet.tsx` las muestra arriba del panel del mapa y en el detalle de cada playa (sin advertencias
no se muestra nada).

- **No hay API ni datos abiertos de alertas** (investigado 04/10/2026): el catálogo de INUMET en
  catalogodatos.gub.uy solo tiene observaciones de estaciones, y el feed CAP registrado en la OMM
  (`https://cap-sources.s3.amazonaws.com/uy-inumet-es/rss.xml`) está abandonado (sin cambios desde
  2020, con alertas de ejemplo).
- **Fuente usada**: `https://www.inumet.gub.uy/alerta` (HTML, ~59 KB, sin autenticación). La página
  trae `var alerta = {...};` y `var cese = {...};` dentro de un `<script>` (es lo que lee su
  `alerta.js`). Se lee en streaming y se corta la descarga apenas termina `var cese` (byte ~45.000).
  Formato no documentado: si cambian la web, se muestra "sin datos recientes", nunca "no hay alertas".
- **Formato**: `advertencias[]` con `riesgoFenomeno` (riesgoViento, riesgoLluvia, riesgoTormenta,
  riesgoVisibilidad, riesgoCalor, riesgoFrio; 1 = sin riesgo, 2 amarilla, 3 naranja, 4 roja),
  `fenomeno`, `probabilidad`, `descripcion`, `comienzo`/`finalizacion` ("YYYY-MM-DD HH:mm", hora de
  Uruguay) y `zonasArray` (`[{ id: "MONTEVIDEO", localidades: [] }]`, vacío = todo el departamento).
  El boletín PDF está en `https://www.inumet.gub.uy/reportes/riesgo/pdf/<alerta.pdf>` (los viejos se borran).
- **Frecuencia** (histórico en `/tiempo/historico-alertas-meteorologicas`, 10/2025–09/2026): 25 a 93
  publicaciones por mes en todo el país; durante un evento se renuevan cada ~3 h y `finalizacion` es
  la próxima renovación. Las vencidas se descartan (en el servidor y, cada minuto, en el navegador).
- **Cache**: sin ETag ni Last-Modified útil (Drupal + Cloudflare, `max-age=60`), así que no hay HEAD
  barato: cache en memoria de 10 min, timeout de 8 s y, si falla, se reintenta a los 10 min. Si la
  última lectura buena tiene más de 1 h, se muestra "sin datos recientes" con enlace a INUMET.
- **Validar**: `curl -s https://www.inumet.gub.uy/alerta | grep -o 'var alerta = .\{0,300\}'`; para ver
  una advertencia real con el formato completo, el Wayback Machine del 19/02/2026 (`/web/20260219134431id_/https://www.inumet.gub.uy/alerta`).

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
- **Temporada:** sigue a la de guardavidas y cierra el 30 de abril; desde el 1 de mayo se vota para
  la siguiente (`'2026-27'` = 1/5/2026 al 30/4/2027). Calculada en la base (`temporada_actual()`) y en
  `temporadaMeGusta()` de `src/lib/me-gusta-temporada.ts` (cambiar las dos juntas). "En total" = suma de todas las temporadas.
- **Lectura (servidor):** `GET {URL}/rest/v1/me_gusta_totales?select=playa,temporada,total` con
  header `apikey: <clave publicable>`. ~20 filas por temporada. Cache 5 min (igual que el ISR de la
  página); si falla, la página sale sin me gusta.
- **Lectura (navegador):** la misma consulta, con un `fetch` simple (sin supabase-js), una vez por
  carga en el mapa, la home y `/favoritas` (`useTotalesAlDia` en `src/lib/me-gusta-cliente.ts`). Hace
  falta porque ISR sirve la versión vieja al primer visitante después de un rato sin visitas (pueden
  ser horas) y regenera de fondo: sin esto, el número del HTML podía estar muy atrasado.
- **Escritura (navegador):** RPC `alternar_me_gusta(p_playa)` devuelve `{meGusta, temporada,
  siempre}` en un solo viaje. **Solo si el navegador ya tiene sesión:** al cargar, `me_gusta` de la
  temporada (por RLS trae solo las propias, para pintar las tarjetas en rojo) y
  `estado_me_gusta(p_playa)` al abrir una playa. supabase-js se importa de forma diferida: quien nunca dio me gusta
  no lo descarga. Actualización optimista.
- **Validar:** `curl -X POST {URL}/rest/v1/rpc/temporada_actual -H "apikey: …"` → `"2026-27"`; el
  conector (`get_advisors`) no debe mostrar avisos de seguridad.
- **Vigencia:** es un contador en vivo, no hay dato vencido; el navegador lo trae al día al cargar.
- **Abuso:** Supabase limita la creación de cuentas anónimas por IP (30/h por defecto). Si se
  infla, activar CAPTCHA (Turnstile) en Auth. Limpiar cuentas anónimas sin uso de más de un año.
- **Plan gratis:** el proyecto se pausa tras 7 días sin actividad; en ese caso no se muestran me
  gusta hasta reactivarlo.
- No se suma al puntaje de "¿A qué playa voy?" (siempre ganaría Pocitos).
- **Ranking `/favoritas`:** ordena por me gusta de la temporada (desempate: en total, nombre). Usa
  los mismos datos de `getPlayas()` que `/playas` (ISR 5 min) y el navegador los corrige al cargar
  (`RankingFavoritas`). Cada playa enlaza
  a `/playas?playa=<slug>`. Si la base no responde, avisa en vez de mostrar todo en 0.

## Contacto

Página `/contacto` con un formulario que envía un correo con **Mailgun** (https://www.mailgun.com,
plan gratis: 100/día, un dominio). Código: `src/lib/contacto.ts` (envío y tope por IP),
`src/app/contacto/acciones.ts` (Server Action, valida) y `src/components/FormularioContacto.tsx`.

- **Configurar:** en Mailgun, crear una clave de API (Dashboard → API Security) en
  `MAILGUN_API_KEY` y el dominio de envío en `MAILGUN_DOMAIN` (`.env.local` y en el hosting; si la
  cuenta es de la región UE, `MAILGUN_REGION=eu`; la actual es US. Un 401 "Forbidden" con la clave
  correcta = región equivocada). Poner el correo en `SITIO.contacto`
  (`src/lib/sitio.ts`). Sin todo eso, la página muestra "disponible pronto" en vez del formulario.
- **Quirk:** sin tarjeta cargada solo hay dominio sandbox (`sandboxXXXX.mailgun.org`), que **solo
  envía a "Authorized Recipients"** (hasta 5, cada uno confirma por correo). Agregar ahí
  `SITIO.contacto`; si no, Mailgun responde 403. Con dominio propio verificado (DNS SPF/DKIM),
  cambiar `MAILGUN_DOMAIN`.
- **API:** `POST https://api.mailgun.net/v3/<dominio>/messages` (UE: `api.eu.mailgun.net`), Basic
  auth `api:<clave>`, form-urlencoded `{from, to, subject, text, h:Reply-To}`. `fetch` directo, sin
  SDK. El correo de quien escribe va en `h:Reply-To`.
- **Performance:** la página es estática; el envío es una Server Action (sin JS extra salvo el
  formulario, que también funciona sin JavaScript).
- **Abuso:** campo trampa oculto (`sitio_web`) + 5 mensajes por hora por IP (en memoria, por
  instancia). Si llega spam, sumar Cloudflare Turnstile.
- **Validar:** enviar un mensaje desde `/contacto` y ver que llegue (o el `curl` del comentario de
  `src/lib/contacto.ts`); los envíos y errores se ven en Dashboard → Send → Logs.
- **Vigencia:** no aplica (no muestra datos). No se guarda nada en el servidor.

## Home y novedades

- **Foto de portada** (`public/fotos/atardecer-rambla-montevideo.jpg`): “Atardecer 2017” de Marinna,
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Atardecer_2017.jpg), **CC BY-SA 4.0**
  (atribución obligatoria: va en el pie de la home y en `/terminos#fuentes`). Rambla, Barrio Sur.
  - Cómo bajarla de nuevo (o buscar otra): la API de Commons da las licencias sin scrapear.
    Buscar: `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=Playa+Pocitos+Montevideo&prop=imageinfo&iiprop=url|size|extmetadata`
    (mirar `extmetadata.LicenseShortName` y `Artist`). Para el archivo, pedir `iiurlwidth=2560`
    y usar `thumburl`: las URL `/thumb/...px-` armadas a mano devuelven un HTML de error si el
    ancho no es uno de los que Commons tiene cacheados. Mandar un `User-Agent` propio.
  - Se guardó a 2560 px y calidad 80 (`sips -Z 2560 -s formatOptions 80`, ~1,2 MB). No hace falta
    más chica: `next/image` (import estático) sirve AVIF/WebP al ancho de cada pantalla y genera
    el blur del placeholder. En la home se usa dos veces (hero con `preload` y banda de favoritas, lazy).
- **Foto de “¿Por qué Playas UY?”** (`public/fotos/casilla-guardavidas-buceo.jpg`): “Playa Buceo” de
  Agustín Fernández, foto de la Intendencia de Montevideo subida a
  [Commons](https://commons.wikimedia.org/wiki/File:Playa_Buceo_-_20230113dicimouyaf0028.jpg),
  **CC BY-SA 4.0** (atribución en el pie de la home y en `/terminos#fuentes`). El original es de
  3000 px, así que con `iiurlwidth=2000` la API devuelve el archivo original (`thumburl` sin
  `/thumb/`). La IM sube más fotos de playas a Commons con nombres `…dicimouyaf….jpg`: buscar por
  playa y año.
  - **Versión editada (oct. 2026):** se pasó por Gemini para reemplazar a los guardavidas por
    personas ficticias y el logo de la Intendencia por un emblema inventado. Gemini la devuelve a 2000×1334 con el pie de foto
    “quemado” abajo: se recortó al centro a 2000×1254 (`sips --cropToHeightWidth 1254 2000 -s
    formatOptions 78`, ~375 KB; `--cropOffset` de `sips` no funciona, por eso el corte centrado).
    Por CC BY-SA, la obra derivada va bajo la misma licencia y el pie dice qué se modificó
    (`cambios` en `CREDITOS_FOTOS` de `src/app/page.tsx` y la fuente en `/terminos`).
- **Novedades** (`/novedades`, `/novedades/[slug]`): notas escritas a mano en `src/lib/novedades.ts`,
  sin CMS ni base. Una nota con `fecha` futura queda oculta y aparece sola ese día: las páginas
  (ISR con `revalidate = 3600`; la home, cada 300). Ya está cargada la del inicio de la temporada (15/11).
- **Podio de favoritas** en la home: las 3 playas con más me gusta de la temporada, con
  `getMeGusta()` (un pedido chico a Supabase, cacheado 5 min) y `nombrePlayaPorSlug()` para los
  nombres, sin pedir playas ni clima. Por eso la home es ISR cada 5 min, igual que `/favoritas`. El
  navegador corrige los totales al cargar (`PodioFavoritas`).
- **Cuenta regresiva de la temporada** en el widget del hero: `getTemporada()` (cálculo local, 15/11
  aprox., sin pedidos). Se muestra como “aprox.”: la fecha oficial la anuncia la IM.
- Estructura común de las páginas de texto: `EncabezadoSitio` arriba, título + contenido
  (`PaginaSitio`) y `PieSitio`. La home usa el mismo encabezado en modo `sobreFoto`.

## Legal y privacidad

- Páginas `/terminos` (incluye fuentes y licencias), `/privacidad` y `/contacto`. Completar los datos de
  `src/lib/sitio.ts` (responsable, contacto, hosting) antes de publicar.
- Las rutas que reciben la ubicación usan **POST** (nunca la ubicación en la URL), responden
  `Cache-Control: no-store` y no registran coordenadas. El cliente la redondea a ~100 m.

## Código

- `src/lib/im.ts` — token OAuth2 (cacheado) y llamadas a la IM
- `src/lib/weather.ts` — clima (MET Norway), un pedido por punto redondeado
- `src/lib/sol.ts` — amanecer/atardecer y si es de día (servidor y navegador)
- `src/lib/mar.ts` — temperatura del agua y olas (NOAA, ERDDAP)
- `src/lib/inumet.ts` — advertencias meteorológicas de INUMET para Montevideo
- `src/lib/playas.ts` — une playas + casillas + clima, lógica de temporada
- `src/lib/transporte/` — GTFS, planificador y tiempo real
- `src/lib/me-gusta.ts` / `me-gusta-cliente.ts` — totales (servidor) y botón ❤️ (navegador, Supabase)
- `src/components/mapa/Mapa.tsx` — mapa, buscador y panel de detalle
- `src/components/mapa/ComoIr.tsx` — UI de "cómo llegar en ómnibus"
- `src/components/mapa/capa-casillas.ts` — capa Three.js (instancing + shader de bandera)
- `src/components/mapa/modelo.ts` — geometría low-poly de la casilla
- `src/app/page.tsx` — home (hero con foto, qué hace, gratis, novedades)
- `src/app/novedades/` + `src/lib/novedades.ts` — notas escritas a mano
- `src/app/playas/page.tsx` — mapa de playas
- `src/app/favoritas/page.tsx` — ranking de playas por me gusta
- `src/lib/navegacion.ts` — enlaces del sitio, compartidos por:
  - `src/components/MenuSitio.tsx` — menú del mapa (botón ☰ + cajón)
  - `src/components/EncabezadoSitio.tsx` — encabezado de todas las páginas menos el mapa
  - `src/components/PieSitio.tsx` — pie de todas las páginas menos el mapa
- `src/components/PaginaSitio.tsx` — estructura de las páginas de texto (encabezado, título, pie)
- `src/components/BotonMapa.tsx` — botón principal al mapa (se repite en home, notas y encabezado)

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
- Ya son nacionales: clima (MET Norway y NOAA), mapa y servicios (OpenStreetMap). El transporte (GTFS STM)
  es solo Montevideo; el MTOP publica horarios interdepartamentales en el catálogo de datos abiertos.
