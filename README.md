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

## Código

- `src/lib/im.ts` — token OAuth2 (cacheado) y llamadas a la IM
- `src/lib/weather.ts` — Open-Meteo, todas las playas en 2 requests
- `src/lib/playas.ts` — une playas + casillas + clima, lógica de temporada
- `src/components/mapa/Mapa.tsx` — mapa, buscador y panel de detalle
- `src/components/mapa/capa-casillas.ts` — capa Three.js (instancing + shader de bandera)
- `src/components/mapa/modelo.ts` — geometría low-poly de la casilla
- `src/app/page.tsx` — página principal
