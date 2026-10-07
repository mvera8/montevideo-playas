import type { Metadata } from "next";
import Link from "next/link";
import PaginaSitio from "@/components/PaginaSitio";
import BotonMapa from "@/components/BotonMapa";

export const metadata: Metadata = {
  title: "Página no encontrada",
};

export default function NotFound() {
  return (
    <PaginaSitio
      antetitulo="Error 404"
      titulo="No encontramos esta página"
      bajada="Puede que el enlace esté mal escrito o que la página ya no exista."
    >
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <BotonMapa />
        <Link href="/" className="font-medium text-sky-700 underline-offset-4 hover:underline">
          Ir al inicio
        </Link>
      </div>
    </PaginaSitio>
  );
}
