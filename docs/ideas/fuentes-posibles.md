# Fuentes de datos posibles

**Estado:** lista de candidatas (15/10/2026). Nada medido salvo donde se aclara. Antes de sumar
cualquiera: medir frecuencia y tamaño, revisar licencia (¿permite uso comercial?) y seguir las reglas de
`CLAUDE.md` (README, cabecera del módulo, vigencia, legales).

Ya usamos: MET Norway (clima, viento), NOAA OISST y WaveWatch III (agua, olas), INUMET (alertas),
IM (casillas, banderas, calidad del agua, ómnibus), iNaturalist (aguas vivas), OSM/Overpass y SIT
de la IM (servicios).

## Mar y agua

| Dato | Fuente | Notas |
|---|---|---|
| **Nivel del agua / marea** | Pronóstico PronUy_RPFM del IMFIA (FING, UdelaR): `https://www.fing.edu.uy/imfia/pronostico-marea/`; mareógrafo de Montevideo del SOHMA (Armada) | El más montevideano: con sudestada la playa desaparece. Medido 30/10/2026: **IOC no tiene ninguna estación en Uruguay** y el CSV horario del SHN (`https://www.hidro.gov.ar/oceanografia/AlturasHorarias.asp?export=csv`, ~20 KB, demora < 1 h) solo trae estaciones argentinas, con otro cero. El sitio del IMFIA no respondió en 25 s desde acá. Falta preguntarle al IMFIA y al SOHMA si hay un dato abierto y con qué permiso. |
| **Cianobacterias / clorofila satelital** | Copernicus Marine, o color del océano (VIIRS / Sentinel-3) en ERDDAP de NOAA | Orientativo; la IM manda. Nubes = sin dato. |
| **Enterococos en tiempo real** | IM, equipo en Pocitos | Ver [enterococos-tiempo-real.md](enterococos-tiempo-real.md). |

## Tiempo

| Dato | Fuente | Notas |
|---|---|---|
| **Ráfagas, probabilidad de lluvia, tormentas** | NOAA GFS por NOMADS (dominio público) | MET Norway no los da fuera de Noruega. El filtro de NOMADS permite recortar a un punto y pocas variables (GRIB2). |
| **UV real (con nubes)** | Copernicus CAMS (Atmosphere Data Store) | Gratis con registro y API key; la licencia Copernicus permite uso comercial. |
| Ráfagas y UV (alternativa simple) | Open-Meteo | JSON fácil, pero el plan gratis es **solo no comercial**. |
| **Viento hacia la costa / hacia el agua** | Cálculo propio: viento actual + orientación de cada playa | Sin API nueva. Avisar viento hacia el agua (inflables, nadar lejos). |
| Rayos | NOAA GOES GLM | Archivos pesados: procesar en el servidor. Prioridad baja. |
| Fase de la luna | Cálculo local, como `sol.ts` | Para la noche en la playa. |
| Terremotos | USGS | **No vale la pena**: casi no hay sismos en Uruguay. |

## Fauna

| Dato | Fuente | Notas |
|---|---|---|
| **Lobos, elefante marino, franciscana, tortugas, pingüinos, ballena franca** | iNaturalist, igual que `aguas-vivas.ts` | Medido 15/10/2026 (todos los años): en Montevideo hay pocas observaciones (lobos ~22, elefante marino 10, franciscana 12, tortugas ~12); en toda la costa, cientos. Las especies amenazadas tienen la ubicación oculta (`taxon_geoprivacy`). Siempre "no te acerques, avisá a rescate de fauna". |
| **Radar de especies nuevas** | iNaturalist `observations/species_counts` | Script que lista lo reportado en la caja en los últimos 30 días y que todavía no mostramos, para revisarlo a mano cada tanto. |

## La playa y cómo llegar

| Dato | Fuente | Notas |
|---|---|---|
| **Accesibilidad** (sillas anfibias, pasarelas, rampas) | IM (programa de playas accesibles; verificar si hay datos abiertos) + OSM (`wheelchair`, rampas) | Muy útil y casi nadie lo muestra. |
| Bicicleteros y estacionamiento | OSM / Overpass (ya lo usamos en `servicios.ts`) | Barato: misma consulta, más etiquetas. |
| Eventos en la playa | Agenda de la IM / datos abiertos (verificar) | Temporada: recitales, actividades de los guardavidas. |
| Calidad del aire | Red de monitoreo de aire de la IM (verificar datos abiertos) | Secundario en la playa. |
| Fotos y datos de cada playa | Wikimedia Commons / Wikidata | Licencias libres (citar autor). Mapillary para imágenes de la calle (CC BY-SA). |
| Imagen satelital reciente | Sentinel-2 (Copernicus) | Pesado y con nubes. Prioridad baja. |
