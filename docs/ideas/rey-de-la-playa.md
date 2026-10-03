# Idea pendiente: "Rey/Reina de la playa" (gamificación)

> Estado: **en pausa, para retomar más adelante**. Planificado el 3/10/2026; no hay nada implementado.
> Al retomar: empezar por la sección "Para avanzar necesito que decidas".

## La idea original

"Rey/reina de la playa": usando la ubicación, y quizá un usuario, te proclamás rey o reina y ponés un
nombre como "Rey Juan Carlos Gutierrez", "Reina Margarita" o hasta "Rey Caca". Se puede cambiar, pero
hay que estar sí o sí en la playa (o a tantos metros). Una página aparte con los reyes y reinas
actuales. Si ya sos rey o reina de una playa, no podés serlo de otra.

---

Me gusta la idea, y tiene algo que la hace fuerte: **solo funciona estando en la playa**. Eso es raro
en la web, y conecta con todo lo que ya tiene la app (mapa, casillas 3D, ubicación). Cómo lo pensaría,
los riesgos, y qué decidir antes de escribir código:

## "Rey/Reina de la playa": lo que hay que definir bien

**1. Cómo se gana y cómo se pierde la corona.** Es la decisión más importante, porque define si el
juego es divertido o un caos:

| Regla | Cómo funciona | Problema |
|---|---|---|
| **A. "Rey de la colina"** | Cualquiera en la playa te destrona al instante | La corona cambia de mano cada 5 minutos en Pocitos un sábado; se siente vacía |
| **B. Duelo con defensa** | Para destronarte tienen que estar en la playa, y vos no haber "defendido" (ido) en las últimas X horas | Más justo, pero castiga a quien no puede ir seguido |
| **C. Reinado por constancia** ⭐ | Reina quien más **días distintos** fue a esa playa en los últimos 7 días; si hay empate, quien fue más recientemente | Premia el uso real, es difícil de manipular y genera rivalidades sanas |

Recomiendo la **C**: es la que mejor resiste trampas y la que hace volver a la gente.

**2. Una corona por persona:** se resuelve con una regla única en la base de datos. Si ganás otra
playa, tenés que elegir cuál conservás (o perdés la anterior).

**3. Nombre y título:** está buenísimo que sea libre ("Rey Caca" es justamente el espíritu). Pero
hacen falta tres cosas:
- un **filtro de palabras ofensivas** en español;
- **no permitir nombres de personas reales** que puedan ser suplantación (por ejemplo, un político) o
  acoso a alguien concreto;
- un **botón de denunciar** y la posibilidad de editar o borrar nombres.

Para el título, ofrecer Rey, Reina o **Monarca**, como opción neutra.

**4. "Estar en la playa":** el navegador da la ubicación con una precisión (±10 a 50 m). Propuesta:
- estar a **menos de 150 m de una casilla** o de la costa, que ya tenemos calculada
  (`src/data/orientaciones.json`, línea de costa de OSM);
- una precisión mejor que 50 m;
- verificarlo **en el servidor**, nunca en el navegador.

## Riesgos que conviene asumir desde el principio

- **Trampas con GPS falso:** en Android es fácil y no se puede evitar del todo. Se mitiga, sin
  volverse loco, con:
  - **Validaciones del servidor:** que la precisión sea creíble, y detectar "viajes imposibles"
    (Carrasco y Cerro en 5 minutos).
  - **Constancia:** pedir dos marcas separadas por unos minutos, y la regla C, que exige constancia.
  - **El tono del juego:** es un juego, no hay premios.
- **Seguridad:** el juego no debería incentivar ir de noche ni con tormenta. Se puede cortar la marca
  de "estuve acá" fuera de las horas de sol, o con alerta de tormenta (ya tenemos el clima).
- **Legales (regla 4 del proyecto), con bastante peso:** hoy decimos "no guardamos tu ubicación" y
  "sin cuentas". Con esto cambia. Habría que:
  - **Guardar** la cuenta, el nombre público y las visitas (playa más fecha). La ubicación cruda se
    verifica y **se descarta**: solo queda "estuvo en Pocitos el 3/10".
  - **Actualizar la política de privacidad:** qué se guarda, para qué, cuánto tiempo, cómo se borra y
    que el nombre es público.
  - **Términos:** reglas de convivencia, nombres prohibidos, que podemos quitar contenido y que **no hay
    premios** (si hubiera, entraría en reglamentaciones de sorteos).
  - **Edad mínima:** por la Ley 18.331, con menores la cosa se complica. Sugerencia: **13 años o más**, o
    pedir mayoría de edad para aparecer en el ranking público.

## Base de datos y librerías

**Supabase** encaja perfecto (está conectado como herramienta en las sesiones de Claude Code, así que
se puede crear el proyecto y las tablas desde ahí; crear el proyecto puede tener costo según el plan,
confirmarlo antes):
- **Postgres con PostGIS:** la verificación de distancia ("¿está a menos de 150 m?") se hace dentro de
  la base, rápido y sin poder hacer trampa desde el navegador.
- **Auth:** recomendado **iniciar sesión con Google o correo solo para jugar**. Mirar el mapa sigue sin
  requerir cuenta. Una cuenta por persona hace mucho más difícil crear cuentas falsas que un usuario
  anónimo.
- **Row Level Security:** reglas de quién puede leer y escribir qué.
- **Realtime,** solo en la página de reinos: ver en vivo cuando alguien destrona a otro.

**Librerías JS** (no hace falta un motor de juegos; Phaser y similares serían un cañón para matar una
mosca):
- `canvas-confetti`: festejo al coronarte. Pesa unos 4 KB y se carga solo en ese momento.
- Un filtro de palabras: las librerías existentes vienen en inglés, así que una lista propia en
  español es más confiable.
- `@vercel/og`, que ya viene con Next: una **imagen para compartir** del estilo
  "👑 Rey Caca de Pocitos · 5 días de reinado". Eso solo ya hace marketing gratis.

## Otras ideas que suman a la misma mecánica

1. **Pasaporte de playas:** un sello por cada una de las 19 playas visitadas, y una insignia por
   completarlas todas. Usa la misma verificación de "estar en la playa".
2. **Insignias con datos que ya tenemos** (esto no lo tiene nadie):
   - 🌅 **Atardecer:** fuiste a la hora de la puesta del sol (ya la tenemos).
   - 🥶 **Valiente:** fuiste con el agua medida por la IM por debajo de 16°.
   - 🏳️ **Primer día:** fuiste el 15/11, cuando arrancan los guardavidas.
   - 🌊 **Contra el viento:** fuiste a una playa con viento de frente.
3. **Coronas en el mapa:** una 👑 flotando sobre la casilla 3D de cada playa con monarca, con su nombre
   al tocarla.
4. **"Me destronaron":** un aviso por notificación. Para una segunda etapa.

## Referencias para estudiar antes de diseñar

**La idea ya existe en apps conocidas** (lo más útil para mirar):
- **Foursquare / Swarm, los "alcaldes" (mayors):** el que más check-ins hacía en un lugar en los últimos
  60 días era el alcalde. **Es casi exactamente esta idea**, y es la regla C recomendada. Hay bastante
  escrito sobre qué funcionó y qué no.
- **Strava, "Rey/Reina de la montaña" (KOM/QOM) y "Leyenda local":** la corona por velocidad en un
  tramo, y la "leyenda local" para quien más veces pasó por ahí en 90 días. Muy buena referencia de cómo
  mostrar coronas y rankings sin que sea tóxico.
- **Pokémon GO, gimnasios:** control de lugares físicos y cómo manejan las trampas con GPS falso.
- **Duolingo:** las rachas (días seguidos), útiles para el pasaporte de playas y las insignias.

**Inspiración visual y recursos:**
- **Game UI Database:** capturas de interfaces de cientos de juegos (rankings, logros, insignias).
- **Kenney.nl:** modelos 3D low-poly y elementos de juego **gratis y de uso libre (CC0)**; por ejemplo,
  una corona 3D o accesorios de playa para el mapa.
- **Poly Pizza y Sketchfab:** más modelos 3D (revisar la licencia de cada uno).
- **Dribbble y Behance:** buscar "gamification UI" o "badges" para diseños de insignias y pantallas de
  logros.
- **Octalysis (Yu-kai Chou):** marco teórico de gamificación sobre qué motiva a la gente (logro,
  pertenencia, escasez) y qué la cansa. Útil para no caer en "puntos por todo".

**Librerías:**
- **No sumar un motor de juegos.** MapLibre más three.js (ya en uso) es el tipo de stack de los juegos
  sobre mapas al estilo Pokémon GO. Phaser (2D completo), PixiJS (2D rápido, efectos y partículas),
  Babylon.js y PlayCanvas (3D completos) existen, pero son demasiado para sumar un juego a un mapa.
- **Para dar "emoción" sin pesar** (todas cargadas solo cuando hagan falta):
  - **Lottie** (reproductor dotLottie): animaciones vectoriales livianas; la corona que cae y brilla al
    coronarte. LottieFiles tiene miles (revisar la licencia de cada una).
  - **canvas-confetti:** el festejo, unos pocos KB.
  - **GSAP o Motion:** animaciones de interfaz con "jugo" (rebotes, contadores que suben, tarjetas que
    aparecen). GSAP ahora es gratis completo, incluidos sus plugins.
  - **Howler.js:** sonidos cortos (una fanfarria al coronarte), siempre opcionales.

**Recomendación:** mirar primero **Foursquare (alcaldes) y Strava (leyendas locales)**, que son esta
idea ya probada a escala. Al implementar: **Lottie** para la coronación, **canvas-confetti** para el
festejo y algún modelo de **Kenney** para la corona 3D.

## Propuesta de etapas

1. **MVP:**
   - **Cuentas y perfil:** iniciar sesión, y un perfil con nombre y título.
   - **Juego:** marca de "estuve acá" verificada, la regla C con una corona por persona, y la página
     `/reinos`.
   - **En el mapa y para compartir:** la corona sobre la casilla, la imagen para compartir y el confeti.
   - **Moderación y legales:** la moderación básica y la actualización de los legales.
2. **Pasaporte e insignias.**
3. **Notificaciones** e historial de reinados.

## Para avanzar necesito que decidas

1. **¿Qué regla para la corona?** (A, B o C; recomendado: C)
2. **¿Cuenta con Google o correo para jugar,** o anónimo y aceptar más trampas?
3. **¿Edad mínima?** (13+, o 18+ para el ranking público)
4. **¿Qué radio cuenta como "estar en la playa"?** (propuesto: 150 m)
5. **¿Arrancamos solo con Rey/Reina,** o sumamos el pasaporte desde el principio?

Con esas respuestas: armar el diseño de la base de datos y el plan detallado. Recién ahí crear el
proyecto en Supabase (confirmar el costo antes).
