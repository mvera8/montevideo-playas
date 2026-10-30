# Ideas pendientes

Ideas planificadas pero **todavía no implementadas**. Cada archivo tiene la idea original, el análisis
y, al final, las decisiones que faltan tomar para arrancar.

| Idea | Estado | Necesita |
|---|---|---|
| [Rey/Reina de la playa](rey-de-la-playa.md) | En pausa (3/10/2026) | Base de datos, cuentas, verificación de ubicación |
| [Me gusta en las playas](me-gusta-playas.md) | Implementado (4/10/2026), solo ❤️ | Supabase, cuenta anónima |
| [Foto de playa con sello de datos](foto-de-playa.md) | Implementado (6/10/2026), diseño esquinas | Nada externo: todo en el dispositivo |
| [Reportes en la playa (estilo Waze)](reportes-playa.md) | Base preparada (5/10/2026), falta UI y 3D; revisar ocupación de la IM el 15/11/2026 | Supabase + cuenta anónima (ya existen), ubicación |
| [Cámaras en vivo](camaras-en-vivo.md) | En pausa (6/10/2026) | Antel pide cuenta; Windy pide API key y su cámara de Pocitos está muerta |
| [Enterococos en tiempo real (Pocitos)](enterococos-tiempo-real.md) | Para ver (15/10/2026) | Que la IM instale el equipo y publique el dato |
| [Alerta de niño perdido](nino-perdido.md) | Descartada por ahora (15/10/2026) | Quedan anotados los riesgos (mal uso, datos de menores, push) |
| [Bicicleteros y estacionamientos](bicicleteros-estacionamientos.md) | Idea (15/10/2026) | Medir antes cuántos hay cerca de cada playa en OSM |
| [Imágenes de cada playa](imagenes-de-playas.md) | Idea (15/10/2026) | Elegir fotos de Commons a mano; crédito y licencia por foto |
| [Proyecto en iNaturalist (fauna)](proyecto-inaturalist.md) | Idea (15/10/2026) | Escribirle a NaturalistaUY; cuenta de Playas UY en iNaturalist |
| [Actividades: surf y kite/windsurf](surf-y-kite.md) | Descartada por ahora (30/10/2026), código en un patch | Validar umbrales; el surf rinde más con costa oceánica |
| [Eventos y cortes cerca de la playa](eventos-cerca-de-la-playa.md) | Idea (30/10/2026) | Sin API: lista a mano o leer la agenda de la IM; revisar permiso de uso |
| [Nivel del agua (sudestada)](nivel-del-agua.md) | En pausa (30/10/2026) | Sin fuente de Montevideo: preguntarles al IMFIA y al SOHMA |
| [Fuentes de datos posibles](fuentes-posibles.md) | Lista (15/10/2026) | Nada: candidatas para sumar, con lo que hay que verificar |

"Rey de la playa" y "Me gusta" comparten base de datos (Supabase) y sistema de cuentas: conviene
diseñarlas juntas, y cualquiera de las dos cambia la política de privacidad (hoy el sitio no guarda
datos de usuarios). "Foto de playa" no depende de ellas y se puede hacer antes.
