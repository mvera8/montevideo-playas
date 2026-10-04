@AGENTS.md

# Reglas del proyecto (Playas UY)

Aplicar en **cada** cambio que agregue o modifique datos, fuentes o funciones:

1. **Dejar documentado cómo obtener los datos la próxima vez.** Para cada fuente nueva: URL exacta,
   formato, autenticación, quirks del servidor (p. ej. "no soporta Range", "el zip se genera en
   /sit/tmp"), frecuencia de actualización medida y cómo se valida. Va en el `README.md` (sección de la
   fuente) y en el comentario de cabecera del módulo en `src/lib/`.
2. **Siempre performante.** Medir antes de elegir: bajar solo lo necesario (streaming/corte temprano,
   HEAD + ETag), cachear en memoria con TTL acorde a la frecuencia real del dato, procesar en el
   servidor y mandar al cliente solo lo que usa, mantener las páginas estáticas/ISR (ojo: `cache:
   "no-store"` en un fetch de render vuelve la página dinámica), y en el cliente animar solo
   `transform`/`opacity` o GPU.
3. **Si los datos son muy viejos, avisar.** Calcular la frecuencia real de la fuente y definir un
   umbral de vigencia (ver `DIAS_VIGENCIA` en `src/lib/calidad-agua.ts`); mostrar la fecha y "hace N
   días", y pasar a "sin datos recientes" en vez de mostrar datos vencidos como actuales.
4. **Actualizar siempre los legales.** Toda fuente, dato o función nueva se refleja en
   `src/app/terminos/page.tsx` (fuentes y licencias, alcance y límites de la información, deslinde de
   responsabilidad) y, si toca datos de usuarios o terceros, en `src/app/privacidad/page.tsx`. Nunca
   presentar cálculos propios como oficiales; aclarar que la fuente oficial manda.

## Reutilizar componentes

Antes de crear un componente o repetir markup, buscar si ya existe uno en `src/components/` (o
lógica en `src/lib/`) y reutilizarlo o extenderlo con una prop. Si dos lugares muestran lo mismo,
extraerlo a un componente compartido. Ejemplos: `EncabezadoSitio` (encabezado de las páginas de
texto), `MenuSitio` (menú del mapa), ambos con los enlaces de `src/lib/navegacion.ts`;
`PaginaLegal` para páginas legales; `MeGusta.tsx` para todo lo de me gusta.
