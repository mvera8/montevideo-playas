"use client";

import { useEffect } from "react";

// Animaciones al hacer scroll de la página que lo monta, con dos IntersectionObserver para todo (sin
// listeners de scroll). Los estilos están en globals.css:
// - `data-revelar`: el elemento sube y se enfoca la primera vez que entra en pantalla (`data-visible`).
//   Para escalonar, un `transitionDelay` en el style del elemento.
// - `data-palabra`: cada palabra de la frase destacada se enciende (`data-activa`) al pasar la línea
//   del 60% de la pantalla, en orden de lectura, y se apaga si se vuelve a bajar de esa línea.
export default function Revelar() {
  useEffect(() => {
    const entrada = new IntersectionObserver(
      (registros) => {
        for (const r of registros) {
          if (!r.isIntersecting) continue;
          r.target.setAttribute("data-visible", "");
          entrada.unobserve(r.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    const palabras = new IntersectionObserver(
      (registros) => {
        for (const r of registros) r.target.toggleAttribute("data-activa", r.isIntersecting);
      },
      // La zona "leída" va desde muy arriba de la pantalla hasta la línea del 60%: lo único que cambia el
      // estado es cruzar esa línea, aunque se haga scroll de golpe por encima de la frase.
      { rootMargin: "100000px 0px -40% 0px" },
    );
    document.querySelectorAll("[data-revelar]").forEach((el) => entrada.observe(el));
    document.querySelectorAll("[data-palabra]").forEach((el) => palabras.observe(el));
    return () => {
      entrada.disconnect();
      palabras.disconnect();
    };
  }, []);
  return null;
}
