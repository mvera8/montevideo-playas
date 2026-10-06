"use client";

import { useEffect, useState } from "react";

// Alto (px) que tapa el teclado en pantalla, para subir la hoja de abajo mientras se escribe.
// En iPhone el teclado no achica la página: las cosas `fixed bottom-0` quedan debajo de él. El área
// visible real la da `visualViewport`. Solo cuenta con un campo de texto enfocado (si no, un zoom con
// los dedos también achicaría el viewport) y desde 80 px (barras del navegador que aparecen y se van).
export function useTeclado() {
  const [alto, setAlto] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let cuadro = 0;
    const medir = () => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        const activo = document.activeElement;
        const escribiendo = activo instanceof HTMLInputElement || activo instanceof HTMLTextAreaElement;
        const tapado = Math.round(window.innerHeight - vv.height - vv.offsetTop);
        setAlto(escribiendo && tapado > 80 ? tapado : 0);
      });
    };
    vv.addEventListener("resize", medir);
    vv.addEventListener("scroll", medir);
    window.addEventListener("focusin", medir);
    window.addEventListener("focusout", medir);
    return () => {
      cancelAnimationFrame(cuadro);
      vv.removeEventListener("resize", medir);
      vv.removeEventListener("scroll", medir);
      window.removeEventListener("focusin", medir);
      window.removeEventListener("focusout", medir);
    };
  }, []);

  return alto;
}
