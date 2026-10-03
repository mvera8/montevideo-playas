# Playas UY

Mapa 3D de las playas de Montevideo: buscador, casillas de guardavidas con su bandera
flameando (color real de la IM, dirección según el viento) y temperatura de aire y agua por playa.

- Playas y guardavidas: [Montevideo API de la IM](https://api.montevideo.gub.uy/apidocs/beaches) (OAuth2 client_credentials).
- Clima: [Open-Meteo](https://open-meteo.com) (forecast + marine, sin API key). La IM no publica clima.

## Configuración

```bash
cp .env.example .env.local   # completar IM_CLIENT_ID e IM_CLIENT_SECRET
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

## ¿A qué playa voy? y mejor horario

Lógica pura en `src/lib/recomendacion.ts` (sirve en cliente y servidor):

- **Ranking (0–100)**: bandera vigente (roja/negra la descartan), bandera sanitaria, viento según
  la **orientación de cada playa** (de frente = olas y frío; de tierra = reparada), sensación
  térmica, lluvia, olas, si es de noche y, con la ubicación del usuario, el tiempo de viaje.
  Las orientaciones son aproximadas y están en la tabla `ORIENTACION`.
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
- `src/components/mapa/Mapa.tsx` — mapa, buscador y panel de detalle
- `src/components/mapa/ComoIr.tsx` — UI de "cómo llegar en ómnibus"
- `src/components/mapa/capa-casillas.ts` — capa Three.js (instancing + shader de bandera)
- `src/components/mapa/modelo.ts` — geometría low-poly de la casilla
- `src/app/page.tsx` — página principal
