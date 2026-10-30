# Actividades: surf y kite/windsurf

**Estado:** descartada por ahora (30/10/2026). Se implementó y probó, pero no convenció y se revirtió. El
código quedó en [`surf-y-kite.patch`](surf-y-kite.patch).

## La idea

Un botón "Actividades" al lado de "Viento" en el mapa, con dos opciones: Surf y Kite / windsurf. Por cada
playa dibuja un modelo 3D (ola con surfista o kite con su navegante), con el color de cómo está hoy y una lista
con el motivo.

Las apps que ya existen (Surfline, Surf-Forecast, Windy.app, Windfinder, Wisuki) pronostican por spot. Lo nuestro
sería ayudar a elegir a qué playa ir, no competir con su pronóstico.

## Reglas que se probaron

Son una estimación propia, sin validar con gente que practique en Montevideo.

| Modo | Ideal | Posible | No o peligro |
|---|---|---|---|
| **Surf** | Olas de 0,5 a 2 m, 7 s o más, viento de tierra o menos de 12 km/h | Olas de 4 a 7 s, o el viento no ayuda | Menos de 0,5 m, menos de 4 s, olas que no entran, viento de frente de 25 km/h o más. Peligro con más de 2,5 m |
| **Kite / windsurf** | 20 a 40 km/h, lateral | Viento de frente, o de 40 a 45 km/h | Menos de 20 km/h. Peligro con más de 45 km/h o viento hacia el agua |

De noche no se recomienda ninguna, y con tormenta se marca peligro.

## Lo que aprendimos

- **Surf en Montevideo:** el sitio solo cubre playas del Río de la Plata, así que casi siempre daría "No". El
  30/10/2026 se midieron olas de 0,4 m y 2 s. Tendría más sentido si el sitio llega a la costa oceánica.
- **Modelo de olas:** WaveWatch III (`ww3_global` en PacIOOS) trae `Thgt`, `Tper` y `Tdir`. Las variables de swell
  (`shgt`, `sper`, `sdir`) vinieron `NaN` en los 3 puntos probados frente a Uruguay. La grilla es de 0,5°, sin
  bancos de arena ni arrecifes.
- **Los modelos difieren:** el 30/10/2026, cerca de La Paloma, WaveWatch III dio 0,54 m y Open-Meteo 1,04 m, en
  puntos cercanos pero no idénticos.
- **Open-Meteo Marine:** trae swell, pero su plan gratis es no comercial y puede limitar en hosting compartido.
- **Viento hacia el agua:** `tipo === "tierra"` de `exposicion()` no alcanza para kite, porque deja pasar un lateral
  que ya tira hacia el agua. Se usó `factor < -0.17`.
- **Ráfagas:** MET Norway no las trae para Uruguay, así que un "Ideal" de kite no las considera.
- **Modelos 3D:** la cámara suele mirar desde el agua y ve la ola de atrás. Por eso el surfista va sobre la cresta y
  la ola se afina a los costados; si no, parece una caja.
- **Parapente:** se dejó afuera a propósito, porque depende de lugares de despegue, térmicas y relieve, no de playas.

## Para retomarla

```bash
git apply docs/ideas/surf-y-kite.patch
```

El patch se generó sobre el commit `8874315`; si el código cambió mucho, puede necesitar ajustes. Incluye el texto de
los términos y del README. Antes de publicarla hay que validar los umbrales y revisar en el mapa los estados Posible
y Peligro.

## Para avanzar necesito que decidas

- Qué fue lo que no convenció: la idea, el 3D, el botón o la lista.
- Si vale la pena antes de cubrir la costa oceánica, o si conviene hacer solo kite/windsurf.
