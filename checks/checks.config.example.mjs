// Copiá este archivo a la raíz del proyecto como `checks.config.mjs` y ajustá lo que necesites.
const config = {
  reglas: {
    // "console-log": "off",
    // "next-image": "error",
    // "sin-png": { ignorar: ["public/screenshots/**"] },
  },
  ignorar: [],
  permitirPng: [],
  maxKbImagen: 400,
  // url: "http://localhost:3000",
  // paginas: ["/"],
  // psiKey: "…", // clave de PageSpeed Insights (url-vitals); mejor PSI_API_KEY en .env.local
};

export default config;
