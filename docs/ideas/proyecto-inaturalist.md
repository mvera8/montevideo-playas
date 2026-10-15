# Proyecto en iNaturalist para la fauna de las playas

**Estado:** idea (15/10/2026). Nada creado.

## La idea

Que la fauna (aguas vivas, lobos marinos, tortugas, pingüinos, etc.) se reporte en **iNaturalist**,
cada persona con su propia cuenta, y no en nuestra base. Creamos un **proyecto** en iNaturalist que junta
esas observaciones, lo promocionamos desde la app ("Reportalo en iNaturalist") y mostramos lo que aparece,
como ya hacemos con las aguas vivas ([aguas-vivas.ts](../../src/lib/aguas-vivas.ts)).

Así los [reportes en la playa](reportes-playa.md) propios quedan solo para lo que iNaturalist no cubre:
el estado de la playa (agua verde, basura, algas, "¿sigue ahí?").

## Por qué así y no de otra forma

- **Reportar con la cuenta de cada usuario, conectada desde la app (OAuth):** obliga a registrar la app
  en iNaturalist y a que cada persona inicie sesión desde nuestra app. Demasiado trabajo para nosotros y
  para el usuario.
- **Una sola cuenta de la app que publica lo que reporta la gente:** descartado. Va contra cómo funciona
  iNaturalist (el autor de la observación es quien vio al animal, responde a quienes identifican y es
  dueño de la foto), tendríamos que moderar todo lo que se publica con nuestro nombre (fotos de gente,
  de niños, bromas), habría que pedirle al usuario que nos ceda la licencia de la foto, y si nos suspenden
  la cuenta perdemos todos los reportes y quizás el acceso a la API que usamos para leer.
- **Proyecto de colección:** cada persona sube con su cuenta, nosotros no moderamos ni guardamos nada,
  y los datos son confirmados por la comunidad y sirven a la ciencia (iNaturalist los comparte con GBIF).

## Cómo funciona un proyecto de colección

Es un **filtro guardado**: no hay que "sumar" observaciones a mano, entran solas las que cumplen las
reglas (lugar, especies, grado de calidad). Reglas para el nuestro:

- **Lugar:** la costa de Montevideo (la misma caja de `aguas-vivas.ts` o un lugar dibujado sobre la
  franja costera). Más adelante, quizás toda la costa uruguaya.
- **Especies:** medusas (Scyphozoa, Hydrozoa sin Hydra, Cubozoa), pinnípedos (lobos, elefante marino),
  cetáceos (ballena franca, franciscana, tonina), tortugas marinas, pingüinos. A definir.

Ojo: como es solo un filtro, para **leer** los datos el proyecto no cambia nada (`project_id=` en la
consulta da lo mismo que nuestros filtros). Lo que suma es **tener a dónde mandar a la gente**: una
página con nuestro nombre, una comunidad, estadísticas, y que la gente sepa qué buscamos.

## Lo que encontramos (15/10/2026)

- **Existe NaturalistaUY** (https://www.naturalista.uy), el nodo uruguayo de la red de iNaturalist
  (sitio 28 en `api.inaturalist.org/v1/sites`). Las cuentas y las observaciones son las mismas que en
  iNaturalist. **Conviene escribirles antes de crear el proyecto**: quizás quieran hacerlo en conjunto,
  o ya tengan uno parecido.
- Buscamos proyectos parecidos ("aguas vivas", "medusas uruguay", "mamíferos marinos uruguay", "costa
  montevideo", "playas montevideo", "fauna marina") y no apareció ninguno de Uruguay. Revisar mejor
  desde NaturalistaUY.

## En la app

- Botón **"Reportalo en iNaturalist"** en la ficha de la playa y en la sección de aguas vivas, que abra la
  app de iNaturalist o su página de subida, y el enlace al proyecto.
- Mismo texto de siempre para fauna: **"no te acerques ni lo toques; avisá a rescate de fauna marina"**.
- Avisar que la observación queda pública, con el usuario y la ubicación, salvo que la oculten.
- Ya leemos las observaciones sin confirmar ("needs_id") y las marcamos: lo que se reporte hoy aparece
  en la próxima consulta (caché de 1 h), aunque la especie tarde días en confirmarse.

## Para avanzar hay que

1. Escribirle a NaturalistaUY.
2. Definir el lugar y la lista de especies del proyecto.
3. Crear el proyecto con una cuenta de Playas UY (verificar qué requisitos pide iNaturalist para crear
   proyectos).
4. Sumar las especies nuevas a la lectura (como `aguas-vivas.ts`, o generalizarlo a "fauna") y el botón.
5. Legales: aclarar que el reporte se hace en iNaturalist, bajo sus términos, no en nuestra app.
