# Idea pendiente: "Foto de playa" con sello de datos

> Estado: **implementada (6/10/2026), versión inicial.** Botón 📷 al lado del me gusta en el detalle de
> cada playa: abre la cámara, arma la foto con el sello (diseño "esquinas") y permite compartir o
> descargar. Código: `src/lib/sello-foto.ts` y `src/components/mapa/FotoPlaya.tsx`.
>
> Decidido: un solo diseño (esquinas) con logo y marca, fecha y hora, nombre de la playa, aire, agua,
> viento, bandera (solo en temporada) y el hashtag **#MontevideoPlayas**. La playa es la del detalle
> abierto (no se verifica la ubicación). No se guarda la foto ni se cuenta el uso. Pendiente si se
> quiere: diseños Polaroid/Historia, elegir de la galería, calidad del agua, y probar HEIC en iPhone.

## La idea original

Pensada sobre todo para celular: sacarte una foto en el sitio, y que la página le agregue el nombre del
sitio, la playa en la que estás, la temperatura, la bandera, etc. Cosas copadas que se agregan en los
bordes o las puntas de la foto, para compartir en WhatsApp o Instagram.

---

Tiene una ventaja grande frente a las otras ideas: **no necesita base de datos ni logueo**. Todo se
hace en el celular de la persona: la foto nunca sale de su teléfono.

## Cómo funcionaría

1. **Sacar o elegir la foto:** un botón "📸 Foto de playa" abre la cámara del celular
   (`<input type="file" accept="image/*" capture="environment">`). Funciona en iPhone y Android sin
   instalar nada.
2. **Saber en qué playa estás:** con la ubicación detecta la playa más cercana (por ejemplo, a menos de
   500 m de una casilla). Si no estás en una, la elegís de una lista, y el sello dice la playa sin la
   marca de "estoy acá".
3. **Armar la imagen con los datos de ese momento**, que la app ya tiene:
   - 🏖️ **Playa:** el nombre de la playa y la marca **Playas UY**.
   - 🌡️ **Clima:** la temperatura del aire, la del agua (marcada si es la medida por la IM), el viento
     y el UV.
   - 🚩 **Bandera y agua:** la bandera de la casilla (en temporada) y el estado del agua.
   - 🌅 **Hora y extras:** la fecha, la hora, la puesta del sol y la mini casilla de guardavidas con su
     bandera de color.
4. **Elegir un diseño:**
   - **Esquinas:** datos chicos en las puntas.
   - **Polaroid:** marco blanco con los datos abajo.
   - **Historia:** formato vertical (1080×1920) para estados de WhatsApp e historias de Instagram.
5. **Compartir:** en el celular, el botón "Compartir" abre directamente el menú de WhatsApp, Instagram,
   etc. En la computadora, se descarga.

## Cómo se hace sin librerías pesadas

- **La imagen** se arma con Canvas 2D del navegador, sin dependencias; es lo más rápido y confiable
  (mejor que pasar HTML a imagen). Esperar `document.fonts.ready` antes de dibujar texto.
- **El tamaño** se achica a 1080 px de ancho, el tamaño ideal para redes, así el celular no sufre con
  fotos de 12 megapíxeles.
- **La orientación** de la foto se corrige sola con
  `createImageBitmap(archivo, { imageOrientation: "from-image" })`.
- **Compartir** usa la Web Share API con archivos (`navigator.canShare({ files })` y
  `navigator.share`): en el celular compartir a WhatsApp e Instagram funciona bien; en la computadora,
  la alternativa es descargar.
- **iPhone:** al elegir de la galería puede venir en HEIC; Safari lo suele convertir a JPEG en el
  `<input>`, pero hay que probarlo en un iPhone real.

## Detalles que suman

- **Privacidad:** al rearmar la imagen en Canvas se **borran los datos ocultos de la foto (EXIF)**,
  incluida la ubicación GPS exacta que guardan muchos celulares. Es un plus para decirle al usuario.
- **Datos viejos (regla 3 del proyecto):** si un dato no está vigente (bandera fuera de temporada, agua
  sin muestreo reciente), el sello no lo muestra, en lugar de mostrar algo viejo como si fuera de hoy.
- **Conexión con las otras ideas:** si se hace el [Rey de la playa](rey-de-la-playa.md), el sello podría
  decir "👑 Rey Caca de Pocitos". Y cada foto compartida es publicidad gratis, con la marca y la
  dirección del sitio en el borde.
- **Legales (regla 4 del proyecto):** cambio mínimo. Aclarar en la política de privacidad que las fotos
  se procesan en el dispositivo y no se suben a ningún servidor, y en los términos que cada uno es
  responsable de lo que comparte.

## Para avanzar necesito que decidas

1. **¿Qué diseños de sello para empezar?** (Esquinas, Polaroid, Historia; sugerencia: Esquinas + Historia)
2. **¿Qué datos van en el sello?** (sugerencia: playa, marca, temperatura del aire y del agua, bandera,
   fecha; el resto opcional)
3. **¿Se puede hacer el sello sin estar en la playa** (eligiéndola de una lista), o solo con la ubicación
   verificada?
4. **¿Dónde va el botón?** (sugerencia: en el detalle de cada playa y un botón flotante en el celular)
