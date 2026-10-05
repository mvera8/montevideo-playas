# Idea pendiente: Reportes en la playa (estilo Waze)

> Estado: **base de datos preparada el 5/10/2026**
> (`supabase/migrations/20261005183439_reportes_playa.sql`); falta la UI y la capa 3D.
> La base usa los valores recomendados de abajo como provisorios. Cambiarlos es fácil: los tipos y
> las duraciones están en `reporte_duracion()`.
> Reusa la cuenta anónima y la base de [Me gusta](me-gusta-playas.md), y la capa 3D de las casillas.
> Al retomar: empezar por la sección "Para avanzar necesito que decidas".

## La idea original

Poder reportar algo en la playa, como en Waze se reporta un auto al costado o un accidente. Por
ejemplo una foca o un lobo marino. Que aparezca algo en 3D en el mapa si más de una persona lo
reportó, y preguntar "¿sigue ahí?" a quien esté en la playa.

---

## ¿Qué se puede reportar?

Cosas que **cambian en el día** y que sirven para decidir a qué playa ir:

| Tipo | Por qué sirve | Dura vivo |
|---|---|---|
| 🦭 **Lobo marino / foca** | Llamativo, ideal para el 3D | ~4–6 h |
| 🪼 **Aguavivas / fragata portuguesa** | Muy útil en verano en Uruguay | ~12–24 h |
| 🟢 **Cianobacterias (agua verde)** | Salud; complementa las alertas oficiales | ~24 h |
| 🐢 **Animal varado o herido** (tortuga, pingüino) | Puede terminar en un rescate | ~6 h |
| 🌿 Algas / basura | Secundario | ~12 h |

MVP recomendado: los primeros 3 o 4.

Para fauna, mostrar siempre **"no te acerques ni lo toques; avisá a Prefectura o a un grupo de
rescate de fauna marina"**. No convertirlo en atracción.

## Cómo funciona

1. **Reportar donde estás.** Un botón pide la ubicación del navegador y reporta en ese punto, sin
   elegir en el mapa. Es más simple y obliga a estar en la playa.
2. **Se agrupan solos.** Si ya hay un reporte activo del mismo tipo a menos de ~150 m, el nuevo no
   crea otro: suma una confirmación al existente.
3. **Se ve con 2 o más personas.** Con una sola persona no se muestra en público (como mucho, un punto
   tenue "sin confirmar"). Es el principal freno al troleo.
4. **"¿Sigue ahí?"** Si abrís la app a menos de ~300 m de un reporte activo, te pregunta. "Sí" lo
   extiende; dos "No" lo cierran.
5. **Vence solo.** Cada tipo tiene su duración (`expira`); las consultas filtran
   `expira > now()`, sin cron (uno opcional para limpiar filas viejas).

## Base de datos (Supabase)

Ya está creada (migración `20261005183439_reportes_playa.sql`). Es la misma receta que me gusta:
las tablas están cerradas, todo pasa por funciones (RPC) y los contadores se mantienen con triggers.
**Sin PostGIS:** para distancias de cientos de metros alcanza con haversine en SQL
(`distancia_m()`).

Tablas:
- `reportes`: tipo, playa, lat/lng, `expira`, `confirmaciones` y `negaciones` ("no" seguidos desde
  el último "sí"). No guarda quién reportó.
- `reporte_votos`: un voto por persona por reporte (`sigue` sí/no). Quien reporta cuenta como el
  primer "sí".

Funciones que se llaman desde la app:

| Función | Quién | Qué hace |
|---|---|---|
| `reportar(p_tipo, p_playa, p_lng, p_lat)` | cuenta (anónima) | Suma al reporte activo del mismo tipo a ≤ 150 m, o crea uno |
| `votar_reporte(p_id, p_sigue, p_lng, p_lat)` | cuenta | "¿Sigue ahí?"; solo a ≤ 300 m de un reporte activo |
| `reportes_cerca(p_lng, p_lat)` | cuenta | Activos a ≤ 300 m, incluso los de 1 persona, con `miVoto` |
| `avistamientos_activos()` | cualquiera | Para el mapa: 2 o más personas y sin vencer |

Reglas: un "sí" extiende el vencimiento la duración del tipo; dos "no" seguidos lo cierran; tope de
30 reportes + votos por cuenta por día. Las posiciones públicas salen redondeadas a 4 decimales
(~10 m).

Duraciones provisorias: lobo marino 5 h, aguavivas 18 h, cianobacterias 24 h, fauna varada 6 h.

**Advisor de Supabase:** avisa que las 4 funciones son `SECURITY DEFINER` y se pueden llamar desde
la API. Es a propósito: son la única puerta a tablas cerradas, y cada una valida la cuenta y la
distancia.

**Limpieza:** los reportes vencidos quedan en la tabla. Más adelante, un cron (pg_cron) que borre
los de más de 30 días.

**Privacidad:** no se guarda la ubicación de quien vota (solo se usa para validar), y lo público no
expone quién reportó.

**Límite honesto:** el GPS del navegador se puede falsear. La validación sube la barrera, pero el
filtro real es pedir 2 o más personas.

## El 3D

Una `CapaAvistamientos` con el mismo patrón que `CapaCasillas`
(`src/components/mapa/capa-casillas.ts`): un `InstancedMesh` por tipo, una llamada de dibujo por
tipo.
- Lobo marino: modelo low-poly (procedural o un `.glb` chico), con un balanceo suave en el shader,
  como el flameo de la bandera.
- Aguavivas y cianobacterias: mejor una mancha o círculo sobre el agua que un objeto.
- La opacidad o el tamaño crece con las confirmaciones.

## Detalles

- **Sin geofencing en la web.** No se puede avisar "estás cerca" con la app cerrada. La pregunta
  aparece solo al abrirla. Para avisar con la app cerrada haría falta app nativa.
- **Actualización:** al principio, volver a consultar cada 1–2 min mientras el mapa está visible.
  Supabase Realtime, después si hace falta.
- **Rendimiento (regla 2):** lo público sale de una sola RPC liviana; la capa 3D se dibuja en GPU.
- **Datos viejos (regla 3):** mostrar "reportado hace N min" y nunca un reporte vencido.
- **Legales (regla 4):**
  - Privacidad: se usa la ubicación para reportar y votar.
  - Términos: los reportes son de usuarios, no oficiales; para cianobacterias manda la intendencia.
  - Uso aceptable: nada de reportes falsos.

## Para avanzar necesito que decidas

1. **¿Qué tipos entran en el MVP?** (Recomendado: lobo marino, aguavivas, cianobacterias, fauna
   varada.)
2. **¿Un reporte con una sola persona se muestra** (tenue, "sin confirmar") **o queda oculto** hasta
   que haya 2?
3. **¿Cuánto dura cada tipo** y cuánto lo extiende un "sí, sigue"?
4. **Modelo del lobo marino:** ¿procedural en código (cero descargas) o un `.glb` low-poly?
