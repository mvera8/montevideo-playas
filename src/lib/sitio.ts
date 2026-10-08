// Datos del sitio (marca y páginas legales). COMPLETAR los campos marcados antes de publicar.
const NOMBRE = "Montevideo";
// Cobertura actual: si se extiende a otros departamentos (ver README, "Extender a todo Uruguay"),
// cambiar acá y la marca se actualiza en toda la interfaz.
const ALCANCE = "Playas";

export const SITIO = {
  nombre: NOMBRE,
  // Dominio principal (Vercel). playas.uy, www.playas.uy y playas.uy/montevideo redirigen acá (ver
  // next.config.ts). Lo usan metadataBase, el sitemap y robots.txt.
  url: "https://montevideo.playas.uy",
  alcance: ALCANCE,
  marca: `${NOMBRE} · ${ALCANCE}`,
  // Persona o empresa responsable del sitio y del tratamiento de datos (Ley 18.331).
  responsable: "Martín Vera",
  // Correo público de contacto y destino del formulario de /contacto (ver src/lib/contacto.ts): mientras
  // no se use un dominio propio en Mailgun, tiene que estar en sus "Authorized Recipients".
  contacto: "tinchobolso8@gmail.com",
  // Proveedor donde se aloja el sitio (aparece en la política de privacidad).
  hosting: "Vercel Inc.",
  actualizado: "8 de octubre de 2026",
};
