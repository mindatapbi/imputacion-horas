"use client";

import { useEffect, useState } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";

// El ID de medición no es secreto (va en el HTML público de la página).
const GA_ID = "G-R5NKMGG27P";
// Solo medimos el dominio de producción, para no mezclar datos de otras URLs.
const GA_HOST = "imputacion-horas.mindata.es";

export default function GA() {
  const [activo, setActivo] = useState(false);

  useEffect(() => {
    setActivo(window.location.hostname === GA_HOST);
  }, []);

  return activo ? <GoogleAnalytics gaId={GA_ID} /> : null;
}
