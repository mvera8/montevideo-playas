import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BANDERAS } from "@/lib/banderas";
import { getPlayas, getSlugsPlayas, type Guardavidas } from "@/lib/playas";
import { SITIO } from "@/lib/sitio";

// Vista previa al compartir una playa. Ver README, "Enlace y tarjeta de cada playa". WhatsApp y similares
// la guardan por días: por eso lleva la hora y aclara que la bandera puede haber cambiado.
export const revalidate = 300;
export const dynamicParams = false; // una dirección inventada da 404 sin pedir datos
export const alt = `Estado de la playa en ${SITIO.marca}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const HORAS_VIGENCIA_CLIMA = 3;
const TZ = "America/Montevideo";
const ORDEN: NonNullable<Guardavidas["bandera"]>[] = ["black", "red", "yellow", "green"];

const logo = `data:image/svg+xml;base64,${await readFile(join(process.cwd(), "public/logo.svg"), "base64")}`;

// Sin esto la imagen se regenera en cada pedido, sin ISR.
export function generateStaticParams() {
  return getSlugsPlayas().map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { fuente, playas } = await getPlayas();
  const playa = playas.find((p) => p.slug === slug);
  if (!playa) return new Response("No existe esa playa", { status: 404 });

  const banderas = ORDEN.map((b) => ({ ...BANDERAS[b], n: playa.guardavidas.filter((g) => g.bandera === b).length })).filter((b) => b.n);
  const sanitarias = playa.guardavidas.filter((g) => g.banderaSanitaria?.activa).length;
  const total = playa.guardavidas.length;
  const clima = playa.clima && Date.now() - new Date(playa.clima.time).getTime() < HORAS_VIGENCIA_CLIMA * 3_600_000 ? playa.clima : null;
  const datos = clima
    ? [
        ["Aire", `${Math.round(clima.airTemp)}°`],
        ...(clima.waterTemp != null ? [["Agua", `${Math.round(clima.waterTemp)}°`]] : []),
        ...(clima.uvMax >= 1 ? [["UV máx.", String(Math.round(clima.uvMax))]] : []),
      ]
    : [];
  const hora = new Intl.DateTimeFormat("es-UY", { timeZone: TZ, day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "60px 72px", background: "#181818", color: "#f6f9fb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 30, color: "#d6c98a" }}>
          <img src={logo} width={70} height={56} alt="" />
          {SITIO.marca}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -2 }}>{playa.nombre}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 34 }}>
            {banderas.length ? (
              banderas.map((b) => (
                <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 22px", borderRadius: 16, background: "#2a2a2a" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: b.color, border: "2px solid #6b6b6b" }} />
                  <span style={{ textTransform: "capitalize" }}>{b.corto[0]}</span>
                  {total > 1 ? ` (${b.n} de ${total})` : ""}
                </div>
              ))
            ) : (
              <div style={{ display: "flex", padding: "10px 22px", borderRadius: 16, background: "#2a2a2a", color: "#c4c4c4" }}>
                {/* Sin datos de la IM no se sabe: "sin bandera" sería falso en plena temporada. */}
                {fuente === "im" ? "Sin bandera vigente" : "Bandera: mirala en el sitio"}
              </div>
            )}
            {sanitarias > 0 && (
              <div style={{ display: "flex", padding: "10px 22px", borderRadius: 16, background: "#7a1616" }}>
                Bandera sanitaria{total > 1 ? ` (${sanitarias} de ${total})` : ""}
              </div>
            )}
          </div>
          {datos.length > 0 && (
            <div style={{ display: "flex", gap: 48, fontSize: 34, color: "#c4c4c4" }}>
              {datos.map(([nombre, valor]) => (
                <div key={nombre} style={{ display: "flex", gap: 12 }}>
                  {nombre} <span style={{ color: "#f6f9fb", fontWeight: 700 }}>{valor}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "#a8a8a8" }}>
          Datos del {hora}. Pueden haber cambiado: mirá el sitio y la bandera en la playa.
        </div>
      </div>
    ),
    size,
  );
}
