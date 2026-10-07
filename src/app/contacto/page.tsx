import type { Metadata } from "next";
import PaginaSitio from "@/components/PaginaSitio";
import FormularioContacto from "@/components/FormularioContacto";
import { Destacado } from "@/components/legal/PaginaLegal";
import { contactoActivo } from "@/lib/contacto";
import { SITIO } from "@/lib/sitio";

export const metadata: Metadata = {
  title: "Contacto",
  description: `Escribile a ${SITIO.nombre}: consultas, errores en los datos o sugerencias.`,
  alternates: { canonical: "/contacto" },
};

export default function ContactoPage() {
  return (
    <PaginaSitio titulo="Contacto" bajada="¿Viste un dato mal, tenés una sugerencia o una consulta? Escribinos.">
      <div className="mt-8">
        <Destacado tono="aviso">
          <p className="text-sm text-slate-700">
            No somos la Intendencia ni el servicio de guardavidas: no podemos cambiar banderas ni horarios. En una
            emergencia llamá al <strong>911</strong>.
          </p>
        </Destacado>
      </div>
      {contactoActivo() ? (
        <FormularioContacto />
      ) : (
        <p className="mt-8 text-slate-600">El formulario de contacto estará disponible pronto.</p>
      )}
    </PaginaSitio>
  );
}
