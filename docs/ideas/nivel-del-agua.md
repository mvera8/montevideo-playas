# Nivel del agua (sudestada)

**Estado:** en pausa (30/10/2026). No hay una fuente de Montevideo que se pueda usar todavía. No se programó nada.

## La idea

Mostrar el nivel del agua en Montevideo: con sudestada sube mucho y casi no queda arena. Sirve para decidir si ir.

## Fuentes revisadas (30/10/2026)

| Fuente | Resultado |
|---|---|
| IOC Sea Level Monitoring (UNESCO) | No tiene ninguna estación en Uruguay (`service.php?query=stationlist&showall=all`). |
| SHN (Argentina): `https://www.hidro.gov.ar/oceanografia/AlturasHorarias.asp?export=csv` | CSV por hora, ~20 KB, 10 días, menos de 1 h de demora. Solo estaciones argentinas y otro nivel de referencia: usar Pilote Norden u Oyarvide como si fuera Montevideo daría datos falsos. |
| IMFIA, FING, UdelaR (PronUy_RPFM): `https://www.fing.edu.uy/imfia/pronostico-marea/` | La mejor candidata: según sus publicaciones, pronostica el nivel a 3 días y se actualiza a diario. El sitio no respondió en 25 s desde acá, así que no se vio qué publica. |
| SOHMA (Armada) | Opera la estación de Montevideo. No se encontraron sus lecturas publicadas en línea. |

## Para retomar

Preguntarles al IMFIA y al SOHMA si hay un dato abierto, con qué frecuencia y si se puede usar en el sitio.

## Cómo se haría

1. `src/lib/nivel-agua.ts` lee el dato en el servidor, con caché según la frecuencia real de la fuente. Un solo valor para toda la costa de Montevideo: no hay medición por playa.
2. Se aclara siempre si es medido o pronóstico. Un pronóstico nunca dice "ahora".
3. Con una medición de más de unas 3 horas (ajustar según la frecuencia real), pasa a "Sin datos recientes".
4. Al principio, sin cálculos propios como "arena reducida": depende de cada playa y nadie lo calibró. Primero juntar datos y comparar con lo que se ve en la playa. No decir "marea alta": acá el nivel depende mucho del viento.
5. Reglas del proyecto: README, cabecera del módulo, entrada en `/estado` y términos, aclarando que la fuente oficial manda.

## Cómo quedaría

Una tarjeta más en la grilla del detalle, junto a Aire, Agua, Viento y UV (valores de ejemplo):

```text
┌─────────────┐
│ NIVEL       │
│ +1,20 m  ↑  │
│ subiendo    │
│ medido 16:45│
└─────────────┘
```

Al tocarla se despliega la curva del día y una explicación corta: es un valor para toda la costa, y con viento del sudeste puede subir mucho y dejar menos arena.

Si supera un umbral que se defina con la fuente, un aviso arriba, igual que las alertas de Inumet: "Nivel del agua alto: puede haber poca arena". Es lo más útil para decidir si ir, y lo primero que se armaría.
