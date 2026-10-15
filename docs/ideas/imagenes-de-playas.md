# Imágenes de cada playa

**Estado:** idea (15/10/2026). Nada implementado.

No confundir con [Foto de playa con sello de datos](foto-de-playa.md), que es la foto que saca el
usuario. Esta idea es mostrar fotos ya existentes de cada playa, con licencia libre.

## Fuentes

| Fuente | Qué da | Licencia y quirks |
|---|---|---|
| **Wikimedia Commons** | Fotos con coordenadas. API: `commons.wikimedia.org/w/api.php?action=query&list=geosearch&gscoord=LAT%7CLON&gsradius=500&gsnamespace=6` (sin key, pide User-Agent) | Cada foto tiene su licencia (CC BY, CC BY-SA, dominio público): hay que mostrar **autor y licencia** al lado de cada una. |
| **Wikidata** | Ficha de cada playa (si existe): foto principal (`P18`), artículo de Wikipedia | CC0 los datos; la foto sigue con su licencia de Commons. |
| **Mapillary** | Fotos a nivel de la calle (rambla) | CC BY-SA; pide token (gratis). Sirve más para "cómo es la entrada" que para la playa en sí. |

## Primera medición (15/10/2026)

Fotos de Commons con coordenadas a menos de 500 m del centro de algunas playas: Ramírez 317, Carrasco 160,
Pocitos 103, Cerro 22, Malvín 7.

**Ojo:** la cantidad engaña. Las coordenadas son las de la foto, no las de lo que muestra: cerca de
Ramírez entran el Parque Rodó y edificios; muchas son de la rambla, de monumentos o de eventos. Hay que
filtrar (por categoría de Commons, como "Beaches in Montevideo" o "Playa Pocitos", o elegirlas a mano) y
ver cuántas playas quedan con al menos una foto buena. Malvín ya muestra que algunas van a quedar sin foto.

## Cómo hacerla performante

- **Elegir las fotos a mano una vez** (1–3 por playa) y guardar en `src/lib/` el nombre del archivo,
  autor y licencia. Las fotos de una playa no cambian: no hace falta consultar la API en cada render.
- Servir miniaturas de Commons (`upload.wikimedia.org/.../thumb/...`, del ancho que se usa) con
  `next/image`, nunca el original (pesa varios MB).
- Revisar cada tanto que los archivos sigan existiendo (a veces se borran de Commons).

## Al hacerla

- Legales: Wikimedia Commons como fuente, con licencias por foto; crédito visible en cada imagen.
- README: cómo se eligieron, cómo buscar más y cómo verificar que sigan en línea.
