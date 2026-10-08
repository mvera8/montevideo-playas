"use client";

import { IconCamera } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import Modal, { BotonModal } from "@/components/Modal";
import { crearFotoConSello, HASHTAG, type Sello } from "@/lib/sello-foto";
import type { TotalesMeGusta } from "@/lib/me-gusta";
import { meGustaDisponible, useTotalesMeGusta } from "@/lib/me-gusta-cliente";
import { Spinner } from "./BotonUbicacion";

// Botón 📷 al lado del me gusta: abre la cámara, le agrega el sello con los datos de la playa
// (src/lib/sello-foto.ts) y muestra la foto lista para compartir o descargar. Todo en el dispositivo.
// Solo en pantallas táctiles (celular/tablet, `pointer-coarse`): en la computadora `capture` se ignora
// y el navegador abriría el selector de archivos en vez de la cámara.
export default function FotoPlaya({
  slug,
  sello,
  meGusta,
}: {
  slug: string;
  sello: Omit<Sello, "meGusta">;
  meGusta: TotalesMeGusta | null;
}) {
  const totales = useTotalesMeGusta(slug, meGusta);
  const input = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<"nada" | "armando" | "lista" | "error">("nada");
  const [foto, setFoto] = useState<{ archivo: File; url: string } | null>(null);

  // Libera la vista previa al cambiarla o al desmontar.
  useEffect(() => {
    if (foto) return () => URL.revokeObjectURL(foto.url);
  }, [foto]);

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite sacar otra foto igual
    if (!archivo) return;
    setEstado("armando");
    try {
      const blob = await crearFotoConSello(archivo, { ...sello, meGusta: meGustaDisponible ? (totales?.temporada ?? null) : null });
      const final = new File([blob], `montevideo-playas-${slug}.jpg`, { type: "image/jpeg" });
      setFoto({ archivo: final, url: URL.createObjectURL(blob) });
      setEstado("lista");
    } catch {
      setEstado("error");
    }
  }

  const puedeCompartir =
    foto !== null && typeof navigator !== "undefined" && navigator.canShare?.({ files: [foto.archivo] }) === true;

  async function compartir() {
    if (!foto) return;
    try {
      await navigator.share({ files: [foto.archivo], text: HASHTAG });
    } catch {
      // Cancelado por la persona: no hay nada que avisar.
    }
  }

  function cerrar() {
    setEstado("nada");
    setFoto(null);
  }

  return (
    <>
      <button
        onClick={() => input.current?.click()}
        disabled={estado === "armando"}
        aria-label={`Sacar una foto con los datos de ${sello.playa}`}
        title="Foto con los datos de la playa"
        className="hidden shrink-0 touch-manipulation pointer-coarse:flex select-none items-center rounded-full px-2 py-1.5 text-slate-600 ring-1 ring-slate-200 transition-transform hover:bg-slate-50 active:scale-90 disabled:opacity-60 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800"
      >
        {estado === "armando" ? (
          <Spinner />
        ) : (
          <IconCamera className="h-4 w-4" stroke={1.8} aria-hidden />
        )}
      </button>
      <input ref={input} type="file" accept="image/*" capture="environment" onChange={alElegir} className="hidden" />

      <Modal
        abierto={estado === "lista" || estado === "error"}
        onCerrar={cerrar}
        titulo={estado === "error" ? "No pudimos armar la foto" : "Tu foto de playa"}
        acciones={
          estado === "error" ? undefined : (
            <>
              {puedeCompartir && (
                <BotonModal principal onClick={compartir}>
                  Compartir
                </BotonModal>
              )}
              {foto && (
                <a
                  href={foto.url}
                  download={foto.archivo.name}
                  className={`w-full select-none rounded-xl px-4 py-2.5 text-center text-sm font-medium ${
                    puedeCompartir
                      ? "ring-1 ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800"
                      : "bg-sky-600 text-white hover:bg-sky-700"
                  }`}
                >
                  Descargar
                </a>
              )}
              <BotonModal onClick={() => input.current?.click()}>Sacar otra</BotonModal>
            </>
          )
        }
      >
        {estado === "error" ? (
          <p>Probá con otra foto. Si sigue pasando, puede que el navegador no pueda leer ese formato de imagen.</p>
        ) : (
          foto && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- blob local, no pasa por next/image */}
              <img src={foto.url} alt={`Foto de ${sello.playa} con los datos de la playa`} className="max-h-[50vh] w-full rounded-xl object-contain" />
              <p className="text-xs text-slate-500">
                La foto no sale de tu teléfono: no la subimos ni la guardamos. Los datos son orientativos.
              </p>
            </>
          )
        )}
      </Modal>
    </>
  );
}
