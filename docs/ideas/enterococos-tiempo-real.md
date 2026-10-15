# Enterococos en tiempo real (Pocitos)

**Estado:** para ver más adelante (15/10/2026). Solo anotado, nada investigado ni implementado.

## La noticia

Subrayado, 13/10/2026:
https://www.subrayado.com.uy/instalaran-equipo-monitoreo-tiempo-real-detectar-presencia-enterococos-playa-pocitos-temporada-n1020711

- La Intendencia (habla Leonardo Herou, director de Desarrollo Ambiental) va a instalar en **playa
  Pocitos** un equipo que mide **enterococos en tiempo real**, durante esta temporada de verano.
- La IM ya usa los enterococos para decidir si una playa está habilitada para bañarse; según Herou, con
  esto se adelantan un año y medio a lo que va a exigir el nuevo decreto.
- También dicen que van a intensificar el monitoreo de todas las playas, sin más detalles.
- **La nota no dice:** qué equipo es, cada cuánto da resultados, la fecha de instalación ni si los datos
  van a ser públicos o dónde.

## Por qué nos interesa

Hoy la calidad del agua sale de los CSV de muestras de la IM ([calidad-agua.ts](../../src/lib/calidad-agua.ts)):
son muestras de laboratorio, la última puede tener días y la vigencia es de 21 días (`DIAS_VIGENCIA`).
Un dato de Pocitos en el momento sería mucho mejor que eso, y es justo el dato que la app ya muestra.

## Qué chequear cuando arranque la temporada

1. Si la IM publica el dato y dónde: catálogo de datos abiertos (`ckan-data.montevideo.gub.uy`), la API
   de la IM (`api.montevideo.gub.uy`, ya usamos `/environment` y `/beaches` en `im.ts`) o la app
   oficial de playas (`m.montevideo.gub.uy/playas`).
2. Formato, autenticación y frecuencia real (medirla, no confiar en "tiempo real").
3. Qué umbral usa la IM para una sola lectura del equipo y si vale lo mismo que la muestra de laboratorio.
   No presentar una lectura como "habilitada / no habilitada" si la IM no lo hace.
4. Cómo mostrarlo junto con el dato de laboratorio de Pocitos sin que se contradigan, y qué vigencia
   ponerle (horas, no días).
5. Si sale bien: legales (fuente nueva en `terminos`) y README, como cualquier fuente.
