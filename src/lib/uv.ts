// Niveles del índice UV según la escala de la OMS (Índice UV Solar Mundial): texto y color oficial.
export type NivelUv = { texto: string; color: string };

export function nivelUv(uv: number): NivelUv {
  const n = Math.round(uv);
  if (n >= 11) return { texto: "Extremo", color: "#6b49c8" };
  if (n >= 8) return { texto: "Muy alto", color: "#d8001d" };
  if (n >= 6) return { texto: "Alto", color: "#f88700" };
  if (n >= 3) return { texto: "Moderado", color: "#f7e400" };
  return { texto: "Bajo", color: "#4eb400" };
}
