# Bandera de enterococos (naranja)

**Estado:** para ver si aparece (06/11/2026). Solo anotado, nada implementado.

## La historia

- En enero de 2026 la IM anunció una bandera **naranja con una "E" y dos olas** para avisar en la casilla
  cuando se detectaran enterococos
  ([Cronista](https://www.cronista.com/uruguay/actualidad-uy/intendencia-de-montevideo-advierte-por-presencia-de-enterococos-en-playas-de-la-capital-habra-una-bandera-de-alerta/)).
- Los guardavidas la rechazaron y **no se usó**: avisan con la bandera sanitaria de siempre (roja con cruz
  verde), carteles en las casillas y la web
  ([Montevideo Portal](https://www.montevideo.com.uy/Noticias/Guardavidas-no-izaran-bandera-que-indica-enterococos-este-verano-que-cambio-uc950497)).
- El nuevo decreto del Ministerio de Ambiente (enterococos en vez de coliformes) rige desde 2027; la IM lo
  aplica desde marzo de 2026 (Resolución 1136/26). Los coliformes no se miden desde 06/2026 (columna
  vacía en el CSV de muestras).

## Cómo lo informa la IM hoy (verificado 06/11/2026)

API de casillas (`m.montevideo.gub.uy/playas/api/casillas`):

- `safetyFlag`: solo `green`, `yellow`, `red`, `black` (y `noData`). Ninguna naranja.
- `healthFlag` (bandera sanitaria) con la causa en `healthFlagCauseDesc`: `"Lluvias"` (código 9) o
  `"Enterococos"`, más `healthFlagCauseLongDesc` y `healthFlagExpiration`.

El sitio ya muestra las dos banderas por separado (seguridad arriba y sanitaria abajo en el mismo mástil
3D; ícono del panel; "No apta para baños · causa"; resta en el ranking). Ver `banderasDe` en
`src/lib/banderas.ts`.

## Si aparece

Qué revisar en la API, al empezar cada temporada:

1. ¿Llega como un valor nuevo de `safetyFlag` (p. ej. `"orange"`)? Hoy `banderasDe` filtra por `SEGURIDAD`
   (los 4 colores conocidos): un valor nuevo se vería como "sin bandera" hasta sumarlo. ¿O como un campo
   aparte, o como otra causa de `healthFlag`?
2. Su vencimiento y si se usa todo el año o solo en temporada (como la sanitaria).

## Cómo mostrarla, según cómo venga el dato

| Si la IM la manda como… | Opción | En el 3D | En el panel |
|---|---|---|---|
| Un color nuevo de `safetyFlag` (reemplaza al verde/amarillo/rojo) | **A. Un color más** de la bandera de seguridad | El mismo paño de arriba, en naranja con la "E" | Un estado más en `ESTADOS`, filtros y resumen |
| Un campo propio (p. ej. `enterococosFlag`), que convive con la de seguridad y la sanitaria | **B. Tercera bandera** en el mismo mástil | Seguridad arriba, sanitaria al medio, naranja abajo (o naranja en lugar de la sanitaria si la IM nunca iza las dos juntas) | Tercer ícono junto a los otros dos |
| Una causa más de `healthFlag`, o solo carteles/avisos en la web (como hoy) | **C. Cartel junto a la casilla** | Un cartel chico clavado en la arena al lado de la casilla (un `InstancedMesh` más, 1 draw call), con la "E"; no se toca el mástil | Aviso de texto como el de la sanitaria ("Enterococos elevados"), sin bandera |

Criterios para elegir:

- **Mostrar lo que hay en la playa.** Si los guardavidas izan una bandera, va en el mástil (A o B); si
  ponen un cartel, va un cartel (C). No inventar una bandera que la IM no usa.
- **El mástil ya lleva dos.** Con tres, a zoom bajo no se distinguen: probar antes cómo se ve y, si no
  se lee, preferir el cartel (C) aunque la IM use bandera.
- **Que no se contradiga con nuestro cálculo** (sección "Calidad del agua"): si la IM avisa enterococos y
  nuestro cálculo dice "apta" (o al revés), manda la IM y se aclara que el cálculo es propio.

Qué tocar para sumarla:

- Tipos: `SafetyFlag` en `src/lib/im.ts` y `SEGURIDAD` en `src/lib/banderas.ts`.
- 3D: color del paño y, si se quiere, la "E" (`capa-casillas.ts`, hoy la cruz es un caso especial), y
  si convive con las otras dos en el mástil (`SEPARACION_BANDERAS`).
- Panel: `ESTADOS` y el ícono de casilla (`PanelGeneral.tsx`), filtros y resumen ("2 verdes · 1 amarilla").
- Ranking (`recomendacion.ts`): cuánto resta, sin duplicar con la calidad del agua calculada.
- Legales: explicar qué significa en `terminos` (la fuente oficial manda). README, sección banderas.
