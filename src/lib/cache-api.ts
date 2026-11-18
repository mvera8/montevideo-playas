// Cache en el CDN de Vercel para las rutas /api que no dependen del pedido.
//
// No usan ISR (`export const revalidate`): con ISR el CDN sirve la versión vieja al primero que pide
// tras un rato sin pedidos, por vieja que sea, y regenera de fondo. Como estas rutas casi no se
// piden, /api/playas y /api/clima llegaron a dar el clima del día del deploy 12 días después
// (medido 18/11/2026). Con `stale-while-revalidate` acotado, pasado ese tope el CDN llama a la
// función y espera la respuesta: más lento esa vez, pero nunca más viejo que s-maxage + swr.

/** Fresca 5 min; hasta 10 min más se sirve vieja mientras se renueva (tope: 15 min). */
export const CACHE_API_5_MIN = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

/** Fresca 15 min; hasta 15 min más se sirve vieja mientras se renueva (tope: 30 min). */
export const CACHE_API_15_MIN = "public, max-age=60, s-maxage=900, stale-while-revalidate=900";
