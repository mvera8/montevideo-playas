# Ideas pendientes

Ideas planificadas pero **todavía no implementadas**. Cada archivo tiene la idea original, el análisis
y, al final, las decisiones que faltan tomar para arrancar.

| Idea | Estado | Necesita |
|---|---|---|
| [Rey/Reina de la playa](rey-de-la-playa.md) | En pausa (3/10/2026) | Base de datos, cuentas, verificación de ubicación |
| [Me gusta en las playas](me-gusta-playas.md) | Implementado (4/10/2026), solo ❤️ | Supabase, cuenta anónima |
| [Foto de playa con sello de datos](foto-de-playa.md) | Implementado (6/10/2026), diseño esquinas | Nada externo: todo en el dispositivo |
| [Reportes en la playa (estilo Waze)](reportes-playa.md) | Base preparada (5/10/2026), falta UI y 3D | Supabase + cuenta anónima (ya existen), ubicación |
| [Cámaras en vivo](camaras-en-vivo.md) | En pausa (6/10/2026) | Antel pide cuenta; Windy pide API key y su cámara de Pocitos está muerta |

"Rey de la playa" y "Me gusta" comparten base de datos (Supabase) y sistema de cuentas: conviene
diseñarlas juntas, y cualquiera de las dos cambia la política de privacidad (hoy el sitio no guarda
datos de usuarios). "Foto de playa" no depende de ellas y se puede hacer antes.
