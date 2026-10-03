# Idea pendiente: "Me gusta" en las playas

> Estado: **en pausa, para retomar más adelante**. Planificado el 3/10/2026; no hay nada implementado.
> Comparte base de datos y cuentas con [Rey/Reina de la playa](rey-de-la-playa.md): conviene
> diseñarlas juntas.

## La idea original

Darle "me gusta" a las playas. Ese "me gusta" sería propio del sitio y sumaría a los datos de la
playa. Requeriría base de datos y logueo.

---

## ¿Base de datos y logueo?

**Base de datos: sí, sin vuelta.** Los "me gusta" tienen que estar guardados en un lugar compartido.
Si se guardaran solo en el navegador, nadie más los vería y el contador no existiría.

**Logueo: depende de cuánto importe que no se inflen.** Hay tres opciones:

| Opción | Cómo funciona | Riesgo |
|---|---|---|
| **A. Sin cuenta** | Se guarda por navegador, con límites en el servidor | Cualquiera borra los datos del navegador y vuelve a dar "me gusta": fácil de inflar |
| **B. Cuenta anónima automática** ⭐ | Supabase crea una cuenta invisible por dispositivo, sin pedir nada. Si después la persona juega al Rey de la playa, esa cuenta se convierte en una cuenta con Google o correo y conserva sus "me gusta" | Más difícil de inflar que A, sin fricción para el usuario |
| **C. Login obligatorio** | Google o correo | Lo más confiable, pero mucha gente no da "me gusta" si le piden iniciar sesión |

Recomendada: **B**. Comparte la base y el sistema de cuentas con el Rey de la playa, sin obligar a
nadie a registrarse para algo tan liviano.

## Una vuelta que lo hace propio del sitio

Como con la corona, dos niveles:
- ❤️ **Me gusta:** lo da cualquiera, desde cualquier lugar.
- ⭐ **"Estuve y la recomiendo":** solo si estuviste en la playa (con la misma verificación de
  ubicación que el Rey de la playa). Vale más, y es la base de un ranking de **"Favorita de la
  temporada"** que se reinicia cada verano.

## Detalles

- **Un "me gusta" por persona por playa,** que se puede sacar (regla única en la base).
- **Solo se muestra el total:** quién dio cada "me gusta" no es público.
- **Rendimiento:**
  - el total se mantiene precalculado en la base (un trigger que actualiza un contador por playa),
    no se cuenta cada vez;
  - la pantalla se actualiza al instante (actualización optimista) sin esperar al servidor;
  - los totales se cachean (ISR o caché corta).
- **No sumarlo al puntaje del ranking "¿A qué playa voy?":** mezclar popularidad con condiciones
  (viento, agua) haría que siempre gane Pocitos. Mostrarlo aparte ("❤️ 128") en la tarjeta y en el
  detalle de la playa.
- **Legales (regla 4 del proyecto):** cambia la política de privacidad, porque se guardan acciones
  asociadas a una cuenta, aunque sea anónima. Términos: uso aceptable (nada de inflar con bots).

## Para avanzar necesito que decidas

1. **¿Qué opción de cuenta?** (A, B o C; recomendada: B)
2. **¿Solo ❤️ "Me gusta",** o también ⭐ "Estuve y la recomiendo" con verificación de ubicación?
3. **¿Los totales se reinician cada temporada,** son históricos, o ambos ("esta temporada" y "siempre")?
4. **¿Se implementa antes, junto o después del Rey de la playa?** (Comparten la base y las cuentas.)
