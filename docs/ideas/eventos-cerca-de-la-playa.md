# Eventos y cortes cerca de la playa

**Estado:** idea (30/10/2026). Investigado, nada implementado.

## La idea

Mostrar en cada playa lo que pasa cerca: conciertos, ferias y carreras. Las carreras importan por partida doble: son
un evento y además cortan la rambla y desvían ómnibus, algo que afecta a cualquiera que vaya a la playa ese día. Por
ejemplo: "Cerca de acá: Carrera San Felipe y Santiago, 14/11, 19:00 h", con enlace a la fuente.

## Fuentes revisadas (30/10/2026)

| Fuente | Qué trae | Limitación |
|---|---|---|
| [Agenda de la IM](https://montevideo.gub.uy/agenda) | Título, fecha, hora, lugar y descripción; hay archivo en `/agenda-anteriores?page=N` | HTML, sin API ni coordenadas. Mezcla actos, charlas y eventos. Pocos de playa: de unas 10 actividades, 1 en la Rambla y 1 en el Parque Rodó |
| [Buscador de la IM](https://montevideo.gub.uy/buscador?search_api_fulltext=cortes+y+desvios+carrera) | Avisos de cortes y desvíos, con fecha de actualización. 33 resultados para "cortes y desvios carrera" | HTML, depende de la búsqueda y trae ruido |
| [Avisos de la IM](https://montevideo.gub.uy/noticias/cortes-y-desvios-de-la-maraton-de-montevideo-2026) | Calles cortadas, horarios, estacionamiento y desvíos | Texto libre, sin formato fijo. El de la Maratón 2026 se publicó 13 días antes |
| [Noticias de movilidad](https://montevideo.gub.uy/noticias/movilidad) | Noticias de tránsito | Mezcla temas; no se le encontró RSS. El [RSS general](https://montevideo.gub.uy/rss.xml) no sirve: no trae eventos |
| [Catálogo de datos abiertos](https://catalogodatos.gub.uy) | Sin datos de eventos ni de cortes | "eventos Montevideo": lugares. "agenda cultural", "cortes transito" y "maraton": 0 resultados |
| [Cartelera.com.uy](https://cartelera.montevideo.com.uy/) | Cine, teatro y música | Sin datos estructurados; es contenido de un medio, habría que pedir permiso |
| Prensa ([El Observador](https://www.elobservador.com.uy/cortes-y-desvios-a94980/1), [Montevideo Portal](https://www.montevideo.com.uy)) | Repiten los avisos de la IM | Solo como pista: la fuente es la IM |
| [Endorphins](https://app.endorphinsrunning.com/races/montevideo-montevideo), [Marathons.com](https://www.marathons.com/en/events/montevideo-marathon/) | Fechas de carreras | Agregadores: la hora de Endorphins parece un valor por defecto (12:00 AM). Confirmar con el organizador |

Quirks: `/agenda` se cachea 1 hora (`Cache-Control: max-age=3600`) y devuelve `ETag`. Las rutas `/eventos`,
`/cortes-de-transito` y `/transito-y-transporte` dan 404. No se encontró licencia para la agenda ni para los avisos.

## Carreras de referencia en 2026

| Carrera | Fecha | Fuente |
|---|---|---|
| Maratón de Montevideo | 10/5/2026 | IM |
| Half Maratón de Montevideo (sobre la rambla; cortes de 4 a 13 h) | 9/8/2026 | [El Observador, citando a la IM](https://www.elobservador.com.uy/nacional/half-maraton-montevideo-im-anuncio-cortes-transito-y-detallo-el-recorrido-la-carrera-del-domingo-n6053161) |
| San Felipe y Santiago (Rambla de Montevideo) | 14/11/2026, 19:00 h | [Agenda de la IM](https://montevideo.gub.uy/agenda/carrera-san-felipe-y-santiago-2026) |
| Montevideo 15K | 30/11/2026 | Solo Endorphins, sin confirmar |

La lista no está completa. Puede haber otras carreras, ciclismo y eventos que corten la rambla.

## Cómo lo haría

1. **Empezar a mano:** un archivo con las carreras y eventos grandes, con enlace al aviso oficial. Son pocos por año,
   y es lo más confiable.
2. **Automatizar la agenda:** leer `/agenda` una vez por día y filtrar con una lista de lugares hecha a mano (Rambla,
   Parque Rodó, nombres de playas). Sin geocodificación, porque hay lugares como "Rambla de Montevideo" que no son una
   dirección.
3. **Cortes:** mostrar solo "Puede haber cortes" con enlace al aviso de la IM. No interpretar el texto libre para
   decidir qué playas afecta: un error mandaría a alguien a una calle cortada.
4. **Interpretar avisos (más adelante):** sacar calles y horarios del texto solo si los pasos anteriores resultan útiles.

Los eventos pasados desaparecen solos. Si la lectura de la agenda falla, avisar en vez de mostrar "no hay eventos".

## Falta verificar

- Si los avisos de cortes se publican con la misma anticipación en otras carreras (solo se midió uno).
- Cuántos eventos de playa hay en verano: hoy la agenda solo muestra lo próximo.
- Si la IM permite reutilizar la agenda, o si puede dar un feed.
- Si hay un conjunto de datos de ferias vecinales, y qué aportan las ticketeras para los conciertos privados.
- Si los cortes también afectan a "Cómo ir" en ómnibus. Hoy el GTFS no los incluiría.

## Para avanzar necesito que decidas

- Si arrancamos con la lista a mano o con la lectura automática de la agenda.
- Si queremos pedirle a la IM permiso o un feed antes de leer su sitio.

Al implementar hay que actualizar `/terminos`: la fuente oficial manda y puede haber cambios de último momento.
