import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITIO } from "@/lib/sitio";

// Preview al compartir un link del sitio (WhatsApp, X, LinkedIn...). Se genera en el build con el logo
// completo (public/logo.svg, no el favicon recortado) y el mismo fondo oscuro que los íconos; las páginas sin imagen propia heredan esta.
export const alt = `${SITIO.marca}: playas, guardavidas, calidad del agua y clima`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logo = `data:image/svg+xml;base64,${await readFile(join(process.cwd(), "public/logo.svg"), "base64")}`;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 56,
          padding: "0 88px",
          background: "linear-gradient(135deg, #1e1e20 0%, #0f0f10 100%)",
          color: "#f6f9fb",
        }}
      >
        <img src={logo} width={326} height={260} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2 }}>{SITIO.marca}</div>
          <div style={{ fontSize: 38, color: "#d6c98a", lineHeight: 1.3, maxWidth: 640 }}>
            Bandera de guardavidas, calidad del agua, clima y cómo llegar.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
