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

## Dominio y hosting (Vercel)

- **Principal**: `https://montevideo.playas.uy` (`SITIO.url` en `src/lib/sitio.ts`). De ahí salen
  `metadataBase` (`src/app/layout.tsx`), `src/app/sitemap.ts` y `src/app/robots.ts`.
- **Redirecciones 308** (`next.config.ts`): `playas.uy/*` y `www.playas.uy/*` → `montevideo.playas.uy/*`
  (conserva la ruta), y `/montevideo/*` desde cualquier host → `montevideo.playas.uy/*`. `playas.uy`
  queda reservado para una futura portada de todo Uruguay (ver "Extender a todo Uruguay"): ese día
  se sacan las reglas por host.
- **En Vercel** (Project → Settings → Domains): agregar `montevideo.playas.uy`, `playas.uy` y
  `www.playas.uy` al mismo proyecto, los tres como "Connect to an environment: Production" (sin la
  opción "Redirect to" de Vercel, para que las reglas de `next.config.ts` manejen las rutas).
- **DNS** (en el panel del registrador de `.uy`): `playas.uy` → registro `A` a la IP que muestre
  Vercel (hoy `76.76.21.21`); `montevideo` y `www` → `CNAME` al valor que muestre Vercel
  (`cname.vercel-dns.com` o uno propio del proyecto). Alternativa: delegar los nameservers a Vercel
  (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`). El certificado HTTPS lo emite Vercel solo.
- **Validar**: `curl -sI https://playas.uy/montevideo/playas` → `308` con
  `location: https://montevideo.playas.uy/playas`; `curl -s https://montevideo.playas.uy/robots.txt`.
  En local: `curl -sI -H "Host: playas.uy" http://localhost:3000/terminos`.
- Mailgun: para enviar desde `contacto@playas.uy` (y sacar el sandbox) agregar el dominio en Mailgun,
  cargar sus registros DNS y cambiar `MAILGUN_DOMAIN`.

## API

| Endpoint | Devuelve |
| --- | --- |
| `GET /api/playas` | Playas con sus casillas de guardavidas, clima, calidad del agua y aguas vivas reportadas |
| `GET /api/guardavidas` | Casillas (lista plana) y estado de la temporada |
| `GET /api/clima` | Clima actual en Montevideo |
| `GET /api/clima/[playa]` | Clima en una playa, p. ej. `/api/clima/pocitos` |
| `GET /api/pronostico/[playa]` | Pronóstico hora a hora (hoy y mañana) y mejor franja para ir |
| `POST /api/viajes` `{desde:{lat,lon}}` | Minutos y líneas para llegar ahora a cada playa (para el ranking) |
| `GET /api/viajes` | Solo carga el índice del GTFS en la instancia (204). La app lo llama al pedir la ubicación para que el índice (~2,5 s en frío) se arme mientras el GPS responde; calcular los viajes después tarda ~10-25 ms |
| `POST /api/como-ir` `{desde, hasta}` | Opciones en ómnibus (directas o con 1 trasbordo) |
| `GET /api/omnibus/llegadas?tramos=variante:parada,...` | Estimación en vivo de los próximos ómnibus |

Cache: `/api/playas` y `/api/guardavidas` son ISR de 5 min; `/api/clima/[playa]` y
`/api/pronostico/[playa]` mandan `s-maxage=600` y las sirve el CDN de Vercel sin invocar la función.
Las llamadas a la IM (`imGet` en `src/lib/im.ts`) se cachean 5 min con `unstable_cache`, compartido
entre instancias. Ojo: `next: { revalidate }` en un `fetch` con `Authorization` no sirve, porque el
header entra en la clave del cache y el token cambia por instancia y cada ~5 min.

### Vencimiento de las banderas

La API oficial (`/beaches/lifeguardstations`) **no trae** `healthFlagExpiration` ni `safetyFlagExpiration`
(verificado 08/10/2026). Se toman del endpoint que usa el sitio móvil de la IM:

- URL: `https://m.montevideo.gub.uy/playas/api/casillas`. Es GeoJSON (`features[].properties`) y no pide
  autenticación. Usa los mismos `id` de casilla que la API (`MVD:lifeguardstation:N`) y trae además
  `healthFlagCauseLongDesc`, el texto de la recomendación.
- Medido: ~2,7 KB con gzip, ~0,1 s. Manda `cache-control: no-cache`, sin ETag. Se cachea 5 min con
  `unstable_cache` (`getImVencimientos` en `src/lib/im.ts`), igual que la API.
- No está documentado. Si falla o cambia de forma, se sigue con la API sola (devuelve `null` y se loguea).
- Quirk: `healthFlag` llega como **texto** (`"true"`/`"false"`) en ambos endpoints, así que se compara con `"true"`.

Si hay vencimiento, se respeta, también fuera de temporada. Si no lo hay, la bandera solo se considera
válida en temporada (15/11 – 30/04).

**Bandera sanitaria** (roja con cruz verde, "no apta para baños"): la IM la usa todo el año, p. ej. por
24 h después de lluvias (causa 9, "Lluvias"; el 08/10/2026 estaba en las 32 casillas). En el mapa 3D va
en el mismo mástil, debajo de la bandera de seguridad. Si no hay bandera de seguridad, ocupa su lugar en
vez del paño gris. En el panel aparece en cada casilla (no en el título de la sección), con la recomendación de la IM.

### Banderas desde el navegador (cuando el servidor no llega a la IM)

Desde el 26/10/2026 la IM filtra las conexiones desde IP de fuera de Uruguay (nos lo confirmaron: "se
han incrementado los filtros a accesos desde fuera del país" tras un problema de seguridad de PHP).
Todos sus hosts (`api`, `mvdapi-auth`, `m`, `ckan-data`, `intgis`) resuelven al mismo proxy,
`prx.montevideo.gub.uy` (190.64.5.9 / .26), y desde Vercel dan `UND_ERR_CONNECT_TIMEOUT`. Vercel no
tiene región en Uruguay (`gru1` es Brasil). Mientras dure:

- **Servidor** (`getPlayas` en `src/lib/playas.ts`): si la API falla, arma las playas con el snapshot
  `src/data/casillas.json` (las 32 casillas: id, nombre, dirección, playa, ubicación; sin banderas) y
  `fuente: "respaldo"`. El mapa tiene las 19 playas reales con clima, agua y servicios.
- **Navegador** (`useBanderasNavegador` en `src/lib/banderas-cliente.ts`, usado en `Mapa.tsx`): con
  `fuente: "respaldo"`, pide `https://m.montevideo.gub.uy/playas/api/casillas` (~3 KB) y completa las
  banderas por `id` de casilla. Si el clima de la ciudad vino sin UV medido, pide también
  `/playas/api/clima` (369 B). Los visitantes en Uruguay tienen IP uruguaya, así que les responde.
- **CORS**: ese host responde `access-control-allow-origin` reflejando el `Origin` (cualquiera;
  verificado 26/10/2026). La API oficial (`api.montevideo.gub.uy`) también tiene CORS, pero necesita el
  token OAuth y el secreto no puede ir al navegador: **Transporte no tiene esta salida**.
- **Misma lógica de vigencia** en los dos lados: `banderasDe` en `src/lib/banderas.ts` (sin
  `server-only`).
- **Avisos**: mientras el navegador consulta no se muestra nada; si también falla (p. ej. fuera de
  Uruguay), el panel dice "Sin datos de la Intendencia. Se muestran las playas sin banderas." con el
  motivo. `/estado` tiene la sección "Desde tu navegador", que prueba los dos pedidos en vivo.
- **CSP**: `https://m.montevideo.gub.uy` está en `connect-src` (`next.config.ts`).
- **Snapshot**: `npm run casillas` (desde una conexión en Uruguay) lo regenera. Correrlo si la IM agrega,
  saca o mueve casillas, y después `npm run orientaciones` si hay casillas nuevas. Una casilla que no esté
  en el snapshot no aparece en el mapa mientras el servidor no llegue a la IM.
- **Volver atrás**: nada que hacer. Cuando la IM levante el filtro, el servidor vuelve a traer todo
  (`fuente: "im"`) y el navegador deja de pedir.

## Mapa 3D

- Mapa: [MapLibre GL](https://maplibre.org) con tiles de [OpenFreeMap](https://openfreemap.org) (sin API key).
- Casillas: Three.js renderizado **dentro del contexto WebGL del mapa** (custom layer).
  Todas las casillas son un `InstancedMesh` y todas las banderas otro → 2 draw calls en total.
  El flameo es un vertex shader; solo se anima a zoom ≥ 13, a 30 fps, y se pausa con la pestaña oculta
  o con `prefers-reduced-motion`.
- Aguas vivas: frente a cada playa con reportes a menos de 5 km en los últimos 10 días (los mismos del chip
  "reportes cerca", `reportesCerca` en `AguasVivas.tsx`) flota un agua viva 3D, violeta, o roja si alguno es
  fragata portuguesa u Olindias. Un `InstancedMesh` más (1 draw call), semitransparente: el latido de la
  campana, los tentáculos y el sube y baja van en el vertex shader, con el mismo reloj de 30 fps que las
  banderas; de noche brilla. Se corre hacia el agua según la orientación de la playa (más lejos de cerca,
  para no quedar encima de la casilla del medio). Al tocarla se abre la playa con la sección "Aguas vivas"
  desplegada y a la vista: como se corre con el zoom, no hay capa GeoJSON de toque; `aguaVivaEn` de la capa
  proyecta dónde quedó cada una en el último cuadro y compara con el punto tocado.
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
  (~48 KB en vez de 2,2 MB). El corte es con `reader.cancel()`, **no** con `AbortController.abort()`:
  en `next build` Next cachea los fetch sin configuración de caché duplicando la respuesta, y con
  `abort()` su copia nunca terminaba, así que la página no cerraba el prerender ("took more than 60
  seconds", 26/10/2026). Vale para cualquier lectura en streaming con corte temprano.

- Criterio del **Decreto 226/025** (la IM lo aplica desde el 27/03/2026): supera el límite si la media
  de 5 muestras (≤ 40 días) pasa 200 enterococos/100 ml o una muestra pasa 500.
- Es un cálculo con datos públicos: la **habilitación oficial** la comunica la IM (bandera sanitaria).
- Datos con más de 21 días se muestran como "sin muestreo reciente".
- Entra en el ranking: agua fuera de límite resta 30; cianobacterias restan o descartan la playa.

## Clima y mar

Todas las fuentes son gratis **también para uso comercial**, citando la fuente (hoy el sitio no
tiene publicidad; elegirlas así deja la puerta abierta). Antes se usaba Open-Meteo, que gratis es
solo para uso no comercial. Ojo: el plan Hobby de Vercel sí es solo para uso no comercial; si algún
día se suma publicidad, hay que pasar a Pro.

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
  - **Modo viento del mapa** (botón "Viento", `src/components/mapa/Viento.tsx`): por playa, tres
    flechas 3D que flotan sobre el agua y avanzan hacia donde sopla el viento del paso horario actual
    (a 10 m), con color (escala tipo Beaufort en km/h), tamaño y velocidad según la intensidad, y una
    etiqueta de km/h. Reusa el clima que ya trae cada playa: **no hace pedidos nuevos**. (Se probó
    también el ícono de viento con rulos en 3D y se descartó: las flechas se leen mejor.)
  - Las flechas las dibuja `CapaCasillas` (un solo InstancedMesh, animación en el vertex shader; a
    30 fps y a cualquier zoom solo mientras el modo está prendido, quietas con "reducir movimiento").
    Se ubican frente a la playa según su orientación, a distancia constante en pantalla como el agua
    viva; la capa avisa dónde quedaron (`onVientoMovido`) para mover las etiquetas (capa de símbolos).
  - Vigencia: si el paso tiene más de `HORAS_VIGENCIA_VIENTO` (3 h) no se dibujan y la leyenda dice
    "Sin datos recientes de viento". Como el modelo es de ~9 km, playas vecinas suelen mostrar el
    mismo valor. Para algo tipo Windy (campo de partículas) habría que sumar una grilla (NOAA GFS).
  - Al volver a la pestaña del mapa después de 10 min (o si Safari la restaura de su caché), se piden
    los datos de nuevo con `router.refresh()` (`useRefrescarAlVolver` en `Mapa.tsx`): en el celular la
    pestaña queda dormida con el clima de cuando se abrió (p. ej. sin la lluvia que empezó después).
  - El cielo viene como `symbol_code` y se traduce a códigos WMO (`SIMBOLO`).
- **UV medido — sitio móvil de la IM** (`getImUv` en `src/lib/im.ts`): `https://m.montevideo.gub.uy/playas/api/clima`,
  el mismo JSON que usa `m.montevideo.gub.uy/playas` (lo pide su `main.*.js`). Público, sin auth ni ETag,
  369 B, ~0,05 s, `cache-control: no-cache` (verificado 20/10/2026). Trae `ValorIndiceUV { value, dateIssued }`
  (un valor para toda la ciudad), y también `TemepraturaActual` (con esa errata), `IconoClima` y
  `TemperaturaMaxMin` del día, que no se usan. No está documentado: si falla o cambia, la tarjeta muestra solo el
  máximo de MET. Frecuencia medida: un `dateIssued` nuevo cada 5 min (20/10/2026, 18:29:38 → 18:34:38 UTC).
  Cache 5 min (`unstable_cache`, como el ISR de `/playas`); si `dateIssued` tiene más de `HORAS_VIGENCIA_UV` (1 h)
  no se muestra.
  - La tarjeta del clima (`ClimaAhora.tsx`) muestra "UV 4 moderado · máx. hoy 8": el medido de la IM y el máximo
    de `ultraviolet_index_clear_sky` (MET) en lo que queda del día (`uvMax`). Niveles y colores de la OMS en
    `src/lib/uv.ts`. De noche (máx. < 1 y sin dato de la IM) no se muestra.
  - El aviso "UV muy alto" (≥ 8) del ranking "¿A qué playa voy?" usa este UV medido; sin dato vigente, el de MET
    con cielo despejado. No resta puntos: es el mismo en todas las playas. El "mejor horario" sigue con MET (la IM
    no tiene pronóstico por hora).
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
  `alerta.js`). Se lee en streaming y se corta la descarga apenas termina `var cese` (byte ~45.000),
  con `reader.cancel()` y no `abort()` (ver "Calidad del agua").
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

## Aguas vivas reportadas

`src/lib/aguas-vivas.ts` trae los **avistamientos de aguas vivas (medusas) que la comunidad sube a
iNaturalist** en la costa de Montevideo, y `AguasVivas.tsx` los muestra en el detalle de cada playa
(sección "Aguas vivas", con la distancia a la playa) y, si hay reportes cerca, un agua viva 3D en el mapa
(ver "Mapa 3D"). No hay un monitoreo oficial de aguas vivas.

- **URL**: `https://api.inaturalist.org/v2/observations` (JSON, sin API key; pide `User-Agent` y no
  pasar de ~60 pedidos/min). Un solo pedido para toda la costa: caja `swlat=-34.98&swlng=-56.45&nelat=-34.75&nelng=-55.95`
  (Punta Espinillo a Lagomar), `d1` = hace 11 días (10 de vigencia + 1 de margen por la zona horaria), `order_by=observed_on`.
- **Taxones**: `taxon_id=48332,48921,68095` (Scyphozoa, Hydrozoa, Cubozoa) y `without_taxon_id=203710`
  (Hydra, de agua dulce). `quality_grade=research,needs_id` (la segunda se marca "sin confirmar");
  `geoprivacy=open&taxon_geoprivacy=open`, porque las coordenadas ocultas se corren hasta ~20 km.
  Se descartan las de precisión peor que 5 km. Las especies que aparecen: *Lychnorhiza lucerna* (la
  más común), *Chrysaora lactea*, *Olindias sambaquiensis* y *Physalia* (fragata portuguesa); los
  nombres en español están en `NOMBRES` porque iNaturalist casi no los tiene.
- **Quirk**: usar la **v2 con `fields=`** (solo los campos usados): ~1,6 KB. La v1 no tiene `fields` y
  manda fotos, identificaciones y usuario: ~550 KB por 5 observaciones. Tarda ~1,8 s.
- **Frecuencia medida (08/10/2026)**: ~31 observaciones en 2018-2026 en toda la caja, 2 a 7 por año,
  casi todas de noviembre a marzo. Muy pocas: la interfaz aclara que la falta de reportes no significa
  que no haya aguas vivas.
- **Vigencia**: un reporte cuenta como actual hasta 10 días (`DIAS_VIGENCIA`; un arribazón dura días) y
  solo se piden esos días (`d1`). Sin reportes vigentes en la costa, o si iNaturalist no responde, la
  sección "Aguas vivas" de la playa **no se muestra** (con 2 a 7 reportes por año estaría casi siempre
  vacía). "Cerca" = a menos de 5 km (`KM_CERCA`).
- **Cache**: `next: { revalidate: 3600 }` (1 h), timeout de 8 s y, si falla, pausa de 5 min. Si no
  responde, la sección no se muestra (no se afirma que no haya).
- **Licencias**: cada observación tiene la suya (CC0, CC BY, CC BY-NC o todos los derechos). Solo se
  muestran hechos (especie, fecha, lugar aproximado) con enlace a la observación; nada de fotos, textos ni
  nombre de usuario.
- **Validar**: `curl -s "https://api.inaturalist.org/v2/observations?swlat=-34.98&swlng=-56.45&nelat=-34.75&nelng=-55.95&taxon_id=48332,48921,68095&per_page=5&order_by=observed_on&fields=id,observed_on,place_guess,taxon.name"`

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
- **Overpass** a veces responde 502/504/429 (saturado): un reintento a los 2 s, con timeout de 30 s.
  Los espejos públicos probados (kumi.systems, private.coffee) tampoco respondieron (10/2026; el
  15/10/2026 los tres daban 500/502 al mismo tiempo).

Cache en memoria de 24 h, guardando lo último bueno de cada fuente por separado. Si una falla se sigue
con lo último que respondió de ella (o sin ella, si nunca respondió) y se reintenta a los 5 min
(`PAUSA_FALLA`), no a las 24 h. La falla se registra con `console.warn` (es esperable y está manejada). En el mapa: íconos desde zoom 13,5
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

`POST /api/como-ir` y `POST /api/viajes` tienen un límite de pedidos por IP en memoria
(`src/lib/limite.ts`, el mismo que usa el formulario de contacto): 20 y 10 por minuto, con respuesta
429 + `Retry-After`. Es por instancia: frena scripts simples; para algo más fuerte, Vercel Firewall.

La API de transporte de la IM requiere **otra aplicación** en el portal (cada app se asocia a
un solo servicio): `IM_TRANSPORTE_CLIENT_ID` / `IM_TRANSPORTE_CLIENT_SECRET`.

- La IM no ofrece ruteo: el planificador (`src/lib/transporte/planificador.ts`) usa el **GTFS**
  del STM (paradas, horarios y recorridos). Busca viajes directos y con un trasbordo, con paradas
  a ≤ 900 m del origen y ≤ 800 m de la playa, y ordena por hora de llegada.
- El GTFS (~17 MB) se descarga una vez por versión, se guarda en el directorio temporal y se
  procesa en streaming (~2 s). `src/instrumentation.ts` lo precarga al iniciar el servidor, **salvo en
  Vercel** (`VERCEL` definida): ahí cada instancia nueva lo correría aunque nunca atienda "cómo ir"
  (CPU activa del plan Hobby: 4 h por mes), así que se arma la primera vez que alguien lo usa (~3 s).
- En vivo: `upcomingbuses` de la IM devuelve vacío, así que la llegada se estima proyectando la
  posición GPS de cada ómnibus (`/buses`) sobre el recorrido de su variante
  (en este feed `shape_id` = `lineVariantId`). `/buses` se consulta como máximo cada 15 s para
  todos los usuarios y todas las instancias (`unstable_cache`, ~460 KB con 1.232 ómnibus medido el
  08/10/2026; tope de 2 MB por entrada), por el límite de uso de la IM ("un número razonable de
  consultas por segundo", sin cifra; uso intensivo: pci@imm.gub.uy). Si la copia compartida tiene más
  de 60 s (nadie la pidió en un rato), se pide de nuevo en el momento.
- No contempla feriados ni horarios especiales.

### Copia del GTFS (cuando el servidor no llega a la IM)

Desde el 26/10/2026 la IM filtra las IP de fuera de Uruguay (ver "Banderas desde el navegador"). La API de
transporte necesita el token OAuth y ni el token ni `/buses` tienen CORS (verificado 26/10/2026), así que
**no hay salida por el navegador**: los ómnibus en vivo quedan sin servicio mientras dure. Los horarios sí:

- **Subir (desde Uruguay):** `npm run gtfs` (`scripts/gtfs.mjs`). Baja `version.txt` y
  `google_transit.zip` (~17 MB, ~2 s) con las credenciales de transporte y los sube a **Supabase Storage**,
  bucket **público** `gtfs` (lo crea si falta; 1 GB gratis), con la `SUPABASE_SECRET_KEY` local:
  `google_transit-<versión>.zip` (inmutable, `max-age` 1 año) y `version.json`
  (`{ version, archivo, hasta, subido }`, `max-age=60`). El nombre versionado evita que el CDN de
  Supabase sirva un zip viejo con un `version.json` nuevo. Deja las 2 últimas versiones. Si se corta
  (`UND_ERR_SOCKET`, pasó una vez), reintentar.
- **Frecuencia:** la IM publica versión nueva seguido (la del 26/10/2026 vale hasta el 26/11:
  `feed_end_date` de `feed_info.txt`). Correrlo **al menos una vez por mes**; `/estado` ("Copia de los
  horarios del STM") pasa a "Datos viejos" cuando la copia vence.
- **Leer (servidor):** `getIndice` (`src/lib/transporte/gtfs.ts`) prueba la IM; si falla, lee
  `{NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/gtfs/version.json` y baja el zip (~2,5 s). Sin
  secretos en Vercel. Tras una falla no reintenta la IM por 30 min, y con la copia revisa la IM cada
  30 min **en segundo plano** (devuelve el índice que tiene; nadie espera el timeout de ~10 s).
- **Interfaz:** `/api/como-ir` devuelve `horarios: { origen, version, hasta }`. Con `origen: "copia"`,
  "Cómo ir" no consulta llegadas en vivo y lo aclara al pie; si `hasta` ya pasó, avisa que los horarios
  vencieron. `/api/omnibus/llegadas` responde 503 al instante con la copia.
- **Volver atrás:** nada. Cuando la IM responda, el índice vuelve a `origen: "im"` (misma versión: no se
  rearma) y vuelve "en vivo".

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
- **Playas válidas:** tabla `playas` (slug, nombre), sin acceso desde la API. `me_gusta`,
  `me_gusta_totales` y `reportes` tienen foreign key a `playas.slug`, así nadie suma me gusta a una
  playa inventada. Es la misma lista que `NOMBRES_PLAYA` en `src/lib/playas.ts`: **si se agrega una
  playa allá, insertarla también en `playas`** (`insert into public.playas values ('<slug>', '<nombre>')`),
  si no, sus me gusta fallan.
- **Permisos por defecto:** desde `20261016194007_playas_validas_y_permisos.sql`, las tablas,
  secuencias y funciones nuevas de `public` no tienen permisos para `anon`/`authenticated` (ni
  EXECUTE para PUBLIC). Cada migración nueva da los que necesite con `grant` explícito y activa RLS.
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
  conector (`get_advisors`) solo debe mostrar los avisos esperados: "RLS sin políticas" en
  `errores`, `playas`, `reportes` y `reporte_votos` (se usan solo por funciones), las funciones
  `security definer` que se llaman por RPC (`avistamientos_activos`, `registrar_error`, `reportar`,
  `votar_reporte`, `reportes_cerca`), el acceso de cuentas anónimas a `me_gusta`, la protección de
  contraseñas filtradas (no se usan contraseñas) y la FK `reportes_playa_fkey` sin índice (`playas`
  casi nunca cambia). Cualquier otro aviso es nuevo y hay que revisarlo.
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

## Casilla favorita

Dato **propio del sitio**, mismo proyecto de Supabase y misma cuenta anónima que los me gusta (ver
"Me gusta"). Esquema en `supabase/migrations/`: `20261026115250_playa_favorita.sql` (empezó siendo
una playa), `20261026121129_casilla_favorita.sql` (pasó a ser una casilla),
`20261026121753_favoritas_hasta_3.sql` (hasta 3) y `20261030191118_una_sola_favorita.sql` (de vuelta
a una; quien tenía varias se quedó con la última que marcó).

- **Tabla `casilla_favorita`** (PK user_id, casilla, playa FK a `playas.slug`, actualizado): **una
  por persona**, la garantiza la PK. `casilla` es el id de la IM (`MVD:lifeguardstation:1`, el mismo
  de `https://m.montevideo.gub.uy/playas/api/casillas`); no hay tabla de casillas en la base porque
  cambian en la IM, así que solo se valida el formato. RLS: cada uno ve, elige y saca solo la suya.
  **Nada es público**: no hay totales ni ranking.
- **Escritura:** RPC `alternar_favorita(p_playa, p_casilla)` elige la casilla, reemplaza la anterior
  o la saca si ya era esa, y devuelve una lista (`[{playa, casilla}]` o `[]`). Crea la cuenta anónima
  si no había. Botón ⭐ en cada casilla de la sección "Casillas" del detalle
  (`src/components/mapa/Favorita.tsx`).
- **Lectura:** `src/lib/favorita-cliente.ts`. Copia en `localStorage` (`favorita`, JSON
  `{playa, casilla}`) para ordenar el listado y centrar el mapa al instante sin bajar supabase-js.
  Solo si hay sesión se lee la fila propia (`casilla_favorita?select=playa,casilla&limit=1`) una vez
  por carga y se corrige la copia; sin sesión se borra la copia y no se pide nada. La base manda.
- **Orden:** en el listado de `/playas` (tarjetas en escritorio, píldoras en el celular) la playa de
  la favorita va primero, con una estrellita, y el resto sigue en orden alfabético
  (`favoritaPrimero`). Respeta búsqueda y filtro.
- **Centrado inicial:** al abrir `/playas` el mapa vuela a la casilla favorita (o a su playa, si la
  IM dejó de informarla) **sin elegirla**: queda el panel general, sin detalle. Una vez por carga, y
  no corre si se llega con `?playa=` (manda esa playa). Usa la copia local; sin copia, espera a la
  base.
- **Estrella 3D en el mapa:** sobre la casilla favorita gira una estrella dorada (una vuelta cada
  6 s, `VUELTA_ESTRELLA_S` en `capa-casillas.ts`). La matriz se recalcula en cada cuadro solo si hay
  favorita. Gira con la misma regla que las banderas: a 30 fps, solo con zoom ≥ 13 y quieta con
  "reducir movimiento". Si la IM deja de informar la casilla, no hay estrella (la favorita queda
  guardada).
- **Modal (`ModalFavorita`, solo en `/playas`):** avisa si la favorita tiene bandera verde vigente
  (confirmada por la base, mismo dato y misma vigencia de la IM que el resto del mapa) en temporada,
  con un botón "Ver la casilla" que abre la playa con esa casilla elegida. Al cerrarlo se guarda el
  día en `localStorage` (`aviso-favorita-cerrado=2026-10-26`, fecha de Montevideo) y no vuelve hasta
  el día siguiente.
- **Validar:** `select * from casilla_favorita` desde el conector (no por la API); `get_advisors`
  suma solo el aviso esperado de acceso de cuentas anónimas a `casilla_favorita`.

## Foto de playa

Botón 📷 al lado del me gusta en el detalle de cada playa: abre la cámara del celular
(`<input type="file" accept="image/*" capture="environment">`), arma la foto con un sello y la deja para
compartir (Web Share API con archivos; si no se puede, se descarga). Solo se muestra en pantallas táctiles
(`pointer: coarse`): en la computadora `capture` no abre la cámara sino el selector de archivos. Código: `src/lib/sello-foto.ts`
(Canvas 2D, sin librerías) y `src/components/mapa/FotoPlaya.tsx`.

- **No usa fuentes nuevas**: el sello toma los datos que ya tiene el detalle (aire con el ícono del cielo
  de `src/lib/iconos-clima.ts`, compartido con el widget del clima; viento; bandera, en gris fuera de
  temporada o sin dato; me gusta de la temporada), más el logo (`public/logo.svg`) y el hashtag
  #MontevideoPlayas. Las tarjetas de vidrio desenfocan la foto con `ctx.filter` (Safari 18+) o, si no
  está, achicándola y volviéndola a agrandar. Si la foto es horizontal (ancho > alto, ya con la
  orientación EXIF corregida), las tarjetas van en una columna a la derecha para no tapar media foto.
- **Todo en el dispositivo**: la foto no se sube, no se guarda y no se cuenta. Redibujarla en Canvas
  borra el EXIF (incluido el GPS).
- 1080 px de ancho, alto proporcional con tope de 1920 (recorte al centro); JPEG 0,9. La orientación la
  corrige el navegador al dibujar el `<img>`.
- Probar en iPhone real: formato HEIC de la cámara y el menú de compartir.

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
- **Dominio propio (contacto@playas.uy):** el DNS de playas.uy está en ANTEL (`ns1/ns2.anteldata.com.uy`).
  1. Enviar: en Mailgun agregar `mg.playas.uy` (región US) y cargar en ANTEL los registros que muestra
     (TXT SPF y TXT DKIM de `mg.playas.uy`, CNAME `email.mg.playas.uy`; los MX de `mg` no hacen falta),
     más `_dmarc.playas.uy` TXT `v=DMARC1; p=none`. Verificar en Mailgun y poner
     `MAILGUN_DOMAIN=mg.playas.uy` en `.env.local` y Vercel. El código manda como `contacto@playas.uy`.
  2. Recibir: `playas.uy` no tiene MX (medido 08/10/2026), así que un correo a contacto@playas.uy rebota.
     Hace falta un reenvío a la casilla real (MX de `playas.uy` al servicio de reenvío). Recién con eso
     andando, cambiar `SITIO.contacto` a `contacto@playas.uy` (aparece en `/terminos` y `/privacidad`) y
     sumar el servicio de reenvío a la política de privacidad.
  - Validar: `dig +short TXT mg.playas.uy`, `dig +short MX playas.uy`; mandar el formulario y en Gmail
    "Mostrar original" debe decir SPF, DKIM y DMARC `PASS`.
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

- **Foto de portada** (`public/fotos/atardecer-rambla-montevideo.webp`): “Atardecer 2017” de Marinna,
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Atardecer_2017.jpg), **CC BY-SA 4.0**
  (atribución obligatoria: va en el pie de la home y en `/terminos#fuentes`). Rambla, Barrio Sur.
  - Cómo bajarla de nuevo (o buscar otra): la API de Commons da las licencias sin scrapear.
    Buscar: `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=Playa+Pocitos+Montevideo&prop=imageinfo&iiprop=url|size|extmetadata`
    (mirar `extmetadata.LicenseShortName` y `Artist`). Para el archivo, pedir `iiurlwidth=2560`
    y usar `thumburl`: las URL `/thumb/...px-` armadas a mano devuelven un HTML de error si el
    ancho no es uno de los que Commons tiene cacheados. Mandar un `User-Agent` propio.
  - Se guardó a 2560 px y calidad 80 (`sips -Z 2560 -s formatOptions 80`) y después se pasó a WebP
    (~320 KB; la de la casilla, ~95 KB) para que `npm run checks` no la marque. No hace falta
    más chica: `next/image` (import estático) sirve AVIF/WebP al ancho de cada pantalla y genera
    el blur del placeholder. En la home se usa dos veces (hero con `preload` y banda de favoritas, lazy).
- **Foto de “¿Por qué Playas UY?”** (`public/fotos/casilla-guardavidas-buceo.webp`): “Playa Buceo” de
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

## Errores

Registro propio en Supabase en vez de Sentry (decisión 10/2026: sin dependencias nuevas ni script
extra en el cliente). Mismo proyecto que los me gusta. Esquema en
`supabase/migrations/20261010225023_errores.sql`; código en `src/lib/errores.ts`.

- **Por qué no alcanza Vercel:** en el plan Hobby los Runtime Logs duran muy poco y no avisan; los
  Log Drains son solo del plan Pro. Los errores del navegador Vercel no los ve.
- **Servidor:** `onRequestError` en `src/instrumentation.ts` (lo llama Next ante cualquier error de
  render, rutas de API, server actions o proxy). Guarda `contexto = "<routeType> <routePath>"` y el
  `digest`, que es el mismo "Código del error" que ve la persona en la pantalla de error.
- **Navegador:** `error.tsx` y `global-error.tsx` llaman a `reportarErrorCliente`. Si el error trae
  `digest` ya lo registró el servidor y no se repite. Máximo 5 errores distintos por carga.
- **Fuera de React:** `src/instrumentation-client.ts` escucha `error` y `unhandledrejection` en
  `window` (handlers de eventos, el mapa, promesas sin catch); Next lo corre antes de la hidratación.
  Solo scripts del propio origen. Se descarta el ruido (`RUIDO` en `src/lib/errores.ts`): sin
  conexión ("Failed to fetch" / "Load failed"), `AbortError`/`TimeoutError`, "Script error.",
  "ResizeObserver loop" y stacks de extensiones. Si algo molesto se repite en la tabla, sumarlo ahí.
- **Escritura:** `POST {URL}/rest/v1/rpc/registrar_error` con header `apikey: <clave publicable>`,
  directo desde el navegador (no pasa por una ruta de API, para no gastar CPU de Vercel). La función
  agrupa por huella (`md5(origen|mensaje|ruta)`) y día sumando `veces`, recorta los textos, pone un
  tope de **200 errores distintos por día** (los repetidos siguen sumando) y borra lo de más de
  **30 días**. Solo en producción (`NODE_ENV=production`, incluye las previews de Vercel).
- **Qué se guarda:** mensaje, ruta sin query string, contexto, digest, stack (minificado en el
  navegador) y user-agent. Nunca IP ni la cuenta anónima.
- **Leer en la terminal:** `npm run errors` (últimos 50, por día; `-detalle` suma stack, digest y
  navegador; `-limite=200` trae más). **Borrar todo:** `npm run errors -delete` (pide confirmación;
  `-si` para no preguntar). Necesita `SUPABASE_SECRET_KEY=sb_secret_…` en `.env.local` (Supabase →
  Project Settings → API Keys → Secret keys): saltea RLS, así que solo local, nunca `NEXT_PUBLIC_` ni
  en Vercel. Script: `scripts/errores.mjs`.
- **Leer en Supabase:** la tabla no se puede leer con la clave publicable (RLS sin políticas).
  Supabase → Table Editor → `errores`, o en el SQL Editor:
  `select dia, origen, veces, mensaje, ruta, contexto from errores order by ultima desc limit 50;`
- **Validar:** `curl -X POST {URL}/rest/v1/rpc/registrar_error -H "apikey: …" -H "Content-Type:
  application/json" -d '{"p_origen":"cliente","p_mensaje":"prueba"}'` → `204` y aparece la fila
  (borrarla después). Un `GET {URL}/rest/v1/errores` con la clave publicable no debe devolver filas.

## Estado de las fuentes (`/estado`)

Página pública que chequea cada fuente externa y muestra "Funciona", "Datos viejos" o "No responde"
con la causa real del error (p. ej. `fetch failed — UND_ERR_CONNECT_TIMEOUT: Connect Timeout Error
(attempted addresses: 190.64.5.9:443…)`). Código en `src/lib/estado.ts`; página en `src/app/estado/`.

- **Cuándo mirarla:** cuando el mapa dice "Sin datos de la Intendencia" o falta un dato. Es más rápido
  que buscar en los logs de Vercel (que en Hobby duran poco).
- **Ritmo:** ISR de 5 min (`revalidate = 300`): a lo sumo ~12 chequeos por hora por fuente, en
  segundo plano. Cada chequeo tiene tope de 8 s; los que no responden se marcan "No responde".
- **Qué se pide a cada fuente:** lo mínimo. IM Playas y MET Norway pasan por la misma función de la
  app (con su caché); Transporte baja `version.txt` del GTFS (token + API); los sitios móviles de la
  IM, el JSON chico de siempre; calidad del agua y GIS, un `HEAD`; NOAA y PacIOOS solo el eje `time`
  de ERDDAP (`<dataset>.csv?time%5B(last)%5D`, ~50 B); Overpass, `/api/status` (no gasta cupo);
  Inumet, iNaturalist y Supabase, la función de la app (si falla, el detalle queda en los logs).
- **"Datos viejos":** se usan los mismos umbrales que la app (`DIAS_VIGENCIA` de calidad del agua,
  `DIAS_VIGENCIA_SST`, `HORAS_VIGENCIA_UV`); olas, si el pronóstico ya no llega a mañana.
- **Lo que vimos (26/10/2026):** desde Vercel la IM daba `UND_ERR_CONNECT_TIMEOUT` a 190.64.5.9 y
  .26 (`prx.montevideo.gub.uy`, el proxy de todos sus hosts) mientras desde Uruguay respondía en
  70 ms: la IM descarta conexiones de las IP de Vercel, no es un error del sitio.
- **Fuente nueva:** sumarle un chequeo en `DEFS` de `src/lib/estado.ts`.

## Analytics (Google Analytics 4)

`<GoogleAnalytics>` de `@next/third-parties/google` en `src/app/layout.tsx`. Elegido en vez de Vercel
Analytics porque el plan gratis de Vercel lo permite en un solo proyecto.

- **Configurar:** en https://analytics.google.com crear una propiedad GA4 → Admin → Flujos de datos →
  Web (`https://montevideo.playas.uy`) y copiar el ID de medición (`G-XXXXXXX`) en `NEXT_PUBLIC_GA_ID`
  (`.env.local` para probar, y en Vercel → Settings → Environment Variables solo para **Production**,
  así las previews no ensucian los datos). Sin ID no se carga nada.
- **Privacidad:** dejar **desactivadas** las "señales de Google" y el uso compartido de datos
  (Admin → Recopilación de datos), porque la política de privacidad dice que no se usan para
  publicidad. Retención de datos: 14 meses. Si se activa algo de eso, actualizar `/privacidad`.
- **Cookies:** `_ga` y `_ga_*` (hasta 2 años). Se carga sin aviso de consentimiento (decisión
  10/2026); la política lo informa en "Estadísticas de uso".
- **Performance:** el script `gtag.js` se pide después de la hidratación (no bloquea el render ni
  vuelve dinámica ninguna página).
- **Validar:** con el ID cargado, abrir el sitio y ver la visita en GA → Informes → Tiempo real, o
  en la pestaña Network buscar `collect?v=2`.

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
- `src/lib/favorita-cliente.ts` / `src/components/mapa/Favorita.tsx` — casilla favorita ⭐ y su modal
- `src/lib/supabase-navegador.ts` — cliente de Supabase y cuenta anónima del navegador (compartido)
- `src/lib/sello-foto.ts` — foto de playa con sello (Canvas, en el navegador)
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
