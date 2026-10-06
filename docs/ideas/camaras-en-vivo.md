# Cámaras en vivo de las playas

**Estado:** en pausa (6/10/2026). Investigado, nada implementado.

## La idea

Un botón de cámara 📹 al lado del botón de me gusta de cada playa que tenga una cámara en vivo abierta,
para ver cómo está la playa antes de ir.

## Lo que encontramos (6/10/2026)

### Antel TV — https://anteltv.com.uy/camaras

Listado de cámaras en vivo (la página se arma con JavaScript; los enlaces son `https://anteltv.com.uy/play/<id>`).
Las que miran a la costa de Montevideo:

| Cámara | Enlace | Playa probable |
|---|---|---|
| Playa Pocitos | https://anteltv.com.uy/play/2sth7 | Pocitos |
| Playa Pocitos Panorámica | https://anteltv.com.uy/play/2strc | Pocitos |
| Yacht Club Uruguayo | https://anteltv.com.uy/play/2sgqv | Buceo (puerto del Buceo) |
| Club Náutico y Pesca La Estacada | https://anteltv.com.uy/play/2sss23t6 | Punta Carretas / Pocitos (sin verificar qué se ve) |
| Club de Pescadores de Montevideo | https://anteltv.com.uy/play/2st0y | Ramírez / Punta Carretas (sin verificar) |
| Acal Náutico Club | https://anteltv.com.uy/play/2st08 | Sin verificar |

- **Pide iniciar sesión** (cuenta gratis de Antel) para ver cualquier cámara: no se puede embeber; a lo
  sumo enlazar en otra pestaña, avisando que pide cuenta.
- No verificamos qué se ve en las cámaras "sin verificar" (hace falta cuenta).
- Los ids podrían cambiar: si se implementa, guardarlos en un solo lugar (`src/lib/`) y revisar que el
  enlace siga respondiendo.

### Windy — https://www.windy.com (webcams)

- La única cámara de playa en Montevideo es **De los Pocitos Beach** (id `1567043731`), pero su última
  imagen es de **hace 327 días** (medido el 6/10/2026): está muerta. Por la regla de datos viejos no se
  mostraría. La más cercana activa es la del Puerto de Montevideo (no es playa); también hay una del
  aeropuerto de Carrasco.
- Son imágenes/timelapse, no video en vivo.
- API v3 (`https://api.windy.com/webcams/api/v3/webcams`) **pide API key** (header `x-windy-api-key`,
  se crea gratis en https://api.windy.com/keys; sin key responde 403). En el plan gratis las URLs de
  imágenes vencen a los 10 min: hay que pedirlas en cada carga. Términos: citar "Webcams provided by
  Windy.com" y enlazar cada imagen a su página o al player.
- Hay un player público embebible sin key: `https://webcams.windy.com/webcams/public/embed/player/<id>/day`.

### Otros

Windfinder lista webcams en Malvín, Yacht Club, Carrasco/Playa Miramar; parecen agregar cámaras de
otros (sin revisar licencia ni vigencia).

## Para avanzar necesito que decidas

1. ¿Alcanza con **enlazar** a Antel TV aunque pida cuenta? (Opción más simple: sin key, sin embeber.)
2. ¿Crear una API key de Windy para detectar cámaras nuevas y mostrar solo las que actualizaron hace
   poco (p. ej. < 1 hora)?
3. Si aparece una fuente abierta embebible (otra cámara municipal o de un club), ¿la sumamos?

Al implementar: documentar la fuente en el README y en `src/lib/`, mostrar "actualizada hace N min" y
ocultar cámaras viejas, y sumar la fuente y el deslinde a `src/app/terminos/page.tsx`.
